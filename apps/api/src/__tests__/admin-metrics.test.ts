import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../index";
import {
  activatedPerSignupMonth,
  activeTenantsBeforeWindow,
  billedPerMonth,
  billedPerOwnerForMonths,
  billingMonthsPerOwner,
  collectedPerMonth,
  collectedPerOwnerBetween,
  firstBillPerOwner,
  firstPaymentPerOwner,
  lastBillPerOwner,
  monthWindow,
  ownerCohorts,
  ownerIdentities,
  ownersBillingBetween,
  ownersBeforeWindow,
  ownersCreatedPerMonth,
  propertiesCreatedPerMonth,
  runningTotal,
  signupsPerMonth,
  tenantsJoinedPerMonth,
  tenantsVacatedPerMonth,
  type MonthWindow,
} from "../routes/admin/metrics";

/**
 * These are deliberately unit tests. The interesting property of this file is
 * the *shape of the SQL it generates* — whether the month filter can use an
 * index, which table `collected` actually reads, whether voided bills are
 * excluded — and every one of those is decided before a database is involved.
 * Drizzle's `.toSQL()` renders the query without executing it, so all of it is
 * assertable with `TEST_DATABASE_URL` unset, which is the default.
 */

const SOURCE = readFileSync(
  resolve(import.meta.dirname, "../routes/admin/metrics.ts"),
  "utf8",
);

interface Renderable {
  toSQL(): { sql: string; params: unknown[] };
}

const render = (query: Renderable) => query.toSQL().sql;

/**
 * The WHERE clause alone. A `to_char()` in SELECT or GROUP BY is fine — it only
 * labels the bucket — but the same call in WHERE is what makes the planner
 * unable to use an index on the filtered column, so the two must be told apart.
 */
function whereClause(query: Renderable): string {
  const sql = render(query);
  const start = sql.indexOf(" where ");
  if (start < 0) return "";
  const end = sql.indexOf(" group by ", start);
  return end < 0 ? sql.slice(start) : sql.slice(start, end);
}

/** A fixed asOf so every rendered window is reproducible. */
const AS_OF = new Date(2026, 8, 12, 12); // 12 Sep 2026, local noon
const WINDOW: MonthWindow = monthWindow(6, AS_OF);

// ===========================================================================

describe("bug 1: per-month series, not a cumulative `to_char(...) <= $month`", () => {
  /**
   * The old endpoint filtered with `to_char(created_at, 'YYYY-MM') <= $month`.
   * Two things were wrong with it at once: every series became monotonically
   * non-decreasing, so no month could ever show a decline; and the filtered
   * column was wrapped in a function, so no index on it could be used.
   */
  const timestampSeries = [
    ["owners created", () => ownersCreatedPerMonth(WINDOW)],
    ["properties created", () => propertiesCreatedPerMonth(WINDOW)],
    ["signups", () => signupsPerMonth(WINDOW)],
    ["activated", () => activatedPerSignupMonth(WINDOW)],
    ["owner cohorts", () => ownerCohorts(WINDOW)],
  ] as const;

  const dateSeries = [
    ["tenants joined", () => tenantsJoinedPerMonth(WINDOW)],
    ["tenants vacated", () => tenantsVacatedPerMonth(WINDOW)],
    ["tenants before window", () => activeTenantsBeforeWindow(WINDOW)],
    ["collected", () => collectedPerMonth(WINDOW)],
  ] as const;

  const monthTextSeries = [["billed", () => billedPerMonth(WINDOW)]] as const;

  it.each([...timestampSeries, ...dateSeries, ...monthTextSeries])(
    "%s filters with a range predicate, never `to_char(...) <=`",
    (_name, build) => {
      const where = whereClause(build());
      expect(where).not.toMatch(/to_char/);
      expect(where).not.toMatch(/<=/);
      expect(where).toMatch(/>=/);
      expect(where).toMatch(/</);
    },
  );

  it.each([...timestampSeries, ...dateSeries.filter(([name]) => name !== "tenants before window")])(
    "%s labels the bucket with to_char but only outside the WHERE",
    (_name, build) => {
      const query = build();
      // Not asserted for `billed`: bill_month is already YYYY-MM text, so it
      // needs no formatting at all.
      expect(render(query)).toMatch(/to_char/);
      expect(whereClause(query)).not.toMatch(/to_char/);
    },
  );

  it("bounds the window on both sides so the filter is a real range", () => {
    const where = whereClause(ownersCreatedPerMonth(WINDOW));
    // `created_at >= $1 and created_at < $2`, not an open-ended `<= month`.
    expect(where).toMatch(/"created_at" >= \$\d+/);
    expect(where).toMatch(/"created_at" < \$\d+/);
  });

  it("filters bill_month as a lexicographic range, with no function applied", () => {
    const where = whereClause(billedPerMonth(WINDOW));
    expect(where).toMatch(/"bill_month" >= \$\d+/);
    expect(where).toMatch(/"bill_month" < \$\d+/);
    expect(billedPerMonth(WINDOW).toSQL().params).toEqual(
      expect.arrayContaining([WINDOW.firstMonth, WINDOW.monthAfterLast]),
    );
  });

  it("asks for each series once, not once per month", () => {
    // The fan-out was `months.map(async (month) => Promise.all([...5 queries]))`
    // — six months x five queries, thirty round trips for six data points.
    expect(SOURCE).not.toMatch(/months\.map\(\s*async/);
    expect(SOURCE).not.toMatch(/to_char\([^)]*\)\s*<=/);
  });

  it("builds cumulative series as a running sum over the per-month deltas", () => {
    // Seeded with what existed before the window, so month 1 is not 0.
    expect(runningTotal(100, [5, -2, 0, 7])).toEqual([105, 103, 103, 110]);
    // The point of the fix: a cumulative series may now fall.
    expect(runningTotal(10, [-3, -4])).toEqual([7, 3]);
    expect(runningTotal(0, [])).toEqual([]);
  });
});

// ===========================================================================

describe("bug 2: collected comes from the payment ledger, not bill.paid_amount", () => {
  /**
   * `bill.paid_amount` is a *current* value. Summing it under a filter on
   * `bill.created_at` attributes a payment recorded today to the month the bill
   * was raised in, so every past month silently grows as old bills settle —
   * which in this product is constant, because owners back-date offline cash.
   */
  it("sums payment.amount grouped by payment_date", () => {
    const sql = render(collectedPerMonth(WINDOW));
    expect(sql).toMatch(/from "payment"/);
    expect(sql).toMatch(/sum\("payment"\."amount"\)/);
    expect(sql).toMatch(/"payment"\."payment_date" >= \$\d+::date/);
    expect(sql).toMatch(/"payment"\."payment_date" < \$\d+::date/);
    expect(sql).toMatch(/group by to_char\("payment"\."payment_date"/);
  });

  it("never reads paid_amount for a collected figure", () => {
    expect(render(collectedPerMonth(WINDOW))).not.toMatch(/paid_amount/);
    expect(render(collectedPerOwnerBetween("2026-07-01", "2026-09-01"))).not.toMatch(/paid_amount/);
    // And nowhere else in the file either — this is the regression that keeps
    // coming back, because paid_amount is right there on the row being scanned.
    expect(SOURCE).not.toMatch(/paidAmount/);
  });

  it("does not filter collected by the bill's own timestamps", () => {
    const where = whereClause(collectedPerMonth(WINDOW));
    expect(where).not.toMatch(/"bill"\."created_at"/);
    expect(where).not.toMatch(/"bill"\."bill_month"/);
  });

  it("measures 'was this owner active' by when the row was written", () => {
    // payment_date is owner-supplied and routinely back-dated, so it answers
    // "when was the cash taken", not "did they open the app this month".
    const where = whereClause(ownersBillingBetween(WINDOW.startAt, WINDOW.endAt));
    expect(where).toMatch(/"bill"\."created_at" >= \$\d+/);
  });
});

// ===========================================================================

describe("voided bills are excluded from every money figure", () => {
  /**
   * The `bill_balance_consistent` CHECK is exempt for voided rows, so a voided
   * bill can carry a positive `balance` and a `paid_amount` above its total.
   * Anything that sums either without excluding them over-reports.
   */
  const moneyQueries = [
    ["billed / outstanding per month", () => billedPerMonth(WINDOW)],
    ["collected per month", () => collectedPerMonth(WINDOW)],
    ["billed per owner", () => billedPerOwnerForMonths(["2026-07", "2026-08"])],
    ["collected per owner", () => collectedPerOwnerBetween("2026-07-01", "2026-09-01")],
    ["billing months per owner", () => billingMonthsPerOwner(WINDOW)],
    ["last bill per owner", () => lastBillPerOwner()],
    ["first bill per owner", () => firstBillPerOwner()],
    ["first payment per owner", () => firstPaymentPerOwner()],
    ["activated per signup month", () => activatedPerSignupMonth(WINDOW)],
    ["owners billing in a window", () => ownersBillingBetween(WINDOW.startAt, WINDOW.endAt)],
  ] as const;

  it.each(moneyQueries)("%s excludes voided bills", (_name, build) => {
    expect(render(build())).toMatch(/"voided_at" is null/);
  });

  it("excludes them from outstanding, which reads bill.balance directly", () => {
    const sql = render(billedPerMonth(WINDOW));
    expect(sql).toMatch(/sum\("balance"\)/);
    expect(sql).toMatch(/"voided_at" is null/);
  });
});

// ===========================================================================

describe("month boundaries are Asia/Kolkata, not UTC", () => {
  it("opens and closes each month at 00:00 IST", () => {
    const window = monthWindow(1, new Date(2026, 8, 12, 12));
    expect(window.months).toEqual(["2026-09"]);
    // 00:00 IST on 1 Sep 2026 is 18:30 UTC on 31 Aug 2026.
    expect(window.startAt.toISOString()).toBe("2026-08-31T18:30:00.000Z");
    expect(window.endAt.toISOString()).toBe("2026-09-30T18:30:00.000Z");
  });

  it("files a 02:00 IST payment on the 1st under the new month", () => {
    // The case that motivates the whole decision. Under UTC bucketing this
    // instant is still 31 August and would be credited to the closing month —
    // exactly when owners are catching up on last month's cash.
    const window = monthWindow(1, new Date(2026, 8, 12, 12));
    const atTwoAmIst = new Date("2026-09-01T02:00:00+05:30");
    expect(atTwoAmIst.getTime()).toBeGreaterThanOrEqual(window.startAt.getTime());
    expect(atTwoAmIst.getTime()).toBeLessThan(window.endAt.getTime());

    // And the UTC boundary it is NOT using would have excluded it.
    const utcMonthStart = new Date("2026-09-01T00:00:00.000Z");
    expect(atTwoAmIst.getTime()).toBeLessThan(utcMonthStart.getTime());
  });

  it("converts timestamptz to IST before labelling the bucket", () => {
    expect(render(ownersCreatedPerMonth(WINDOW))).toMatch(
      /to_char\("created_at" at time zone 'Asia\/Kolkata', 'YYYY-MM'\)/,
    );
    expect(render(billingMonthsPerOwner(WINDOW))).toMatch(/at time zone 'Asia\/Kolkata'/);
  });

  it("does not shift calendar `date` columns, which carry no zone at all", () => {
    // payment_date, joining_date and vacating_date are already the business
    // calendar. Applying AT TIME ZONE to one would be a second, spurious shift.
    expect(render(collectedPerMonth(WINDOW))).not.toMatch(/at time zone/);
    expect(render(tenantsJoinedPerMonth(WINDOW))).not.toMatch(/at time zone/);
    expect(render(tenantsVacatedPerMonth(WINDOW))).not.toMatch(/at time zone/);
  });

  it("walks whole calendar months across a year boundary", () => {
    const window = monthWindow(6, new Date(2026, 0, 15, 12));
    expect(window.months).toEqual([
      "2025-08",
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
    ]);
    expect(window.monthAfterLast).toBe("2026-02");
    expect(window.firstDay).toBe("2025-08-01");
    expect(window.dayAfterLast).toBe("2026-02-01");
  });

  it("rolls the December window into the next year", () => {
    const window = monthWindow(1, new Date(2026, 11, 15, 12));
    expect(window.monthAfterLast).toBe("2027-01");
    expect(window.endAt.toISOString()).toBe("2026-12-31T18:30:00.000Z");
  });

  it("delegates the month walk to buildMonthlyTrend rather than repeating it", () => {
    expect(SOURCE).toMatch(/import \{ buildMonthlyTrend \}/);
    expect(monthWindow(6, AS_OF).months).toHaveLength(6);
  });
});

// ===========================================================================

describe("empty id lists never reach Postgres as `in ()`", () => {
  /**
   * `inArray(col, [])` renders as `in ()`, which Postgres rejects as a syntax
   * error rather than matching nothing — and "no owner fired a rule today" is
   * the state a healthy platform is supposed to be in.
   */
  it.each([
    ["owner identities", () => ownerIdentities([])],
    ["billed per owner", () => billedPerOwnerForMonths([])],
  ] as const)("%s degrades an empty list to a constant-false predicate", (_name, build) => {
    const sql = render(build());
    expect(sql).not.toMatch(/in \(\)/);
    expect(whereClause(build())).toMatch(/false/);
  });

  it("still emits a real `in` when there is something to match", () => {
    expect(render(billedPerOwnerForMonths(["2026-07", "2026-08"]))).toMatch(/in \(\$\d+, \$\d+\)/);
  });
});

// ===========================================================================

describe("/analytics no longer reports the same number twice", () => {
  /**
   * `ensureOwnerProfile` runs on every user create, so there is exactly one
   * owner_profile per user and `totalUsers` and `totalOwners` were identical by
   * construction — two tiles on the admin dashboard showing one fact.
   */
  it("drops totalUsers in favour of a figure that means something", () => {
    // As a response field. The name survives in the comment explaining why.
    expect(SOURCE).not.toMatch(/totalUsers\s*[:?]/);
    expect(SOURCE).toMatch(/activatedOwners:/);
  });

  it("keeps the three distinct counts the dashboard already reads", () => {
    for (const field of ["totalOwners", "totalProperties", "activeTenants"]) {
      expect(SOURCE).toContain(field);
    }
  });
});

// ===========================================================================

describe("volume is never labelled revenue", () => {
  /**
   * PGKhata has no payment gateway and never touches this money. A tile reading
   * "revenue" would eventually be screenshotted into a fundraising deck.
   */
  it("ships the label and the disclaimer in the payload", () => {
    expect(SOURCE).toContain("Volume under management");
    expect(SOURCE).toMatch(/NOT revenue/);
  });

  it("exposes no field called revenue", () => {
    expect(SOURCE).not.toMatch(/\brevenue\s*[:?]/);
    expect(SOURCE).not.toMatch(/\bgmv\b/i);
  });
});

// ===========================================================================

describe("router hygiene", () => {
  it("adds no router-level middleware", () => {
    /**
     * Every admin sub-router is mounted at "/", so a `router.use(...)` here
     * runs for every request reaching this point in the parent stack —
     * including ones a sibling router handles. That is how `support` admins
     * once got 403 from the impersonation endpoint.
     */
    // Statement position only; the warning in the file header names it too.
    expect(SOURCE).not.toMatch(/^\s*router\.use\(/m);
  });

  it("registers only GETs", () => {
    expect(SOURCE.match(/router\.(get|post|put|patch|delete)\(/g)).toEqual(
      Array(7).fill("router.get("),
    );
  });
});

describe("the metrics endpoints are mounted and behind the admin gate", () => {
  it.each([
    "/v1/admin/analytics",
    "/v1/admin/analytics/trends",
    "/v1/admin/metrics/overview",
    "/v1/admin/metrics/funnel",
    "/v1/admin/metrics/retention",
    "/v1/admin/metrics/churn-risk",
    "/v1/admin/metrics/volume",
  ])("%s answers 401 without a session", async (path) => {
    const res = await request(app).get(path);
    expect(res.status).toBe(401);
  });
});

describe("churn risk is an actionable list", () => {
  it("links every row to Owner 360", () => {
    expect(SOURCE).toContain("`/dashboard/owners/${ownerId}`");
  });

  it("compares two complete months, never a partial one", () => {
    // Comparing a month in progress against a finished one flags most of the
    // platform on the 3rd of every month.
    expect(SOURCE).toMatch(/shiftMonth\(thisMonth, -1\)/);
    expect(SOURCE).toMatch(/shiftMonth\(thisMonth, -2\)/);
  });

  it("keeps the three documented thresholds", () => {
    expect(SOURCE).toMatch(/BILLING_LAPSED_DAYS = 45/);
    expect(SOURCE).toMatch(/NO_TENANT_DAYS = 30/);
    expect(SOURCE).toMatch(/COLLECTION_DROP_PP = 20/);
  });
});

describe("retention is measured by billing, not by logins", () => {
  it("reads the bill table for cohort activity", () => {
    const sql = render(billingMonthsPerOwner(WINDOW));
    expect(sql).toMatch(/from "bill"/);
    expect(sql).toMatch(/group by "property"\."owner_id", to_char/);
  });

  it("never joins the session table", () => {
    // The word survives in the prose explaining why logins are not the signal.
    const imports = SOURCE.slice(0, SOURCE.indexOf('from "@pgkhata/db"'));
    expect(imports).not.toMatch(/\bsession\b/);
    expect(render(billingMonthsPerOwner(WINDOW))).not.toMatch(/"session"/);
  });
});

describe("owner attribution always walks property.ownerId", () => {
  /**
   * `property.owner_id` is the only ownerId column in the schema; everything
   * else reaches an owner through propertyId -> property.ownerId or
   * tenantId -> tenant.propertyId.
   */
  it.each([
    ["billing months", () => billingMonthsPerOwner(WINDOW)],
    ["last bill", () => lastBillPerOwner()],
    ["first payment", () => firstPaymentPerOwner()],
    ["collected per owner", () => collectedPerOwnerBetween("2026-07-01", "2026-09-01")],
  ] as const)("%s groups by property.owner_id", (_name, build) => {
    const sql = render(build());
    expect(sql).toMatch(/"property"\."owner_id"/);
    expect(sql).toMatch(/"property" on "tenant"\."property_id" = "property"\."id"/);
  });
});

describe("seed queries for the cumulative series", () => {
  it("counts what existed before the window with a bare range predicate", () => {
    const where = whereClause(ownersBeforeWindow(WINDOW));
    expect(where).toMatch(/"created_at" < \$\d+/);
    expect(where).not.toMatch(/to_char/);
  });
});
