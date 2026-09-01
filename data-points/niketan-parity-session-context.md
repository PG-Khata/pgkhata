# PGKhata V1 — Niketan-parity session (AI context handoff)

**Date:** 2026-08-30
**Status label vocabulary (same as `AI-work-log.md`):** Verified = read in current source / confirmed by a passing test or command output in this session. Planned = decided but not implemented. Not implemented = explicitly out of scope, flagged, not silently dropped.

**Purpose of this file:** a single, self-contained document another AI (or a human) can read cold to understand exactly what changed in this session, why, what still needs a decision, and how to verify any of it without re-deriving anything from chat history. Prefer this file over `build-log-2026-08-30.md` (narrative log, same session, less structured) or `missing-features.md` (the original gap list this session worked from — still useful as the spec, but does not reflect what was actually built or how).

---

## 1. What this session was

Starting state: `apps/web` had a working Next.js frontend with auth, property/room/tenant/billing/payment CRUD, and Resend email — built in an earlier session (see `build-log-2026-08-30.md`'s first section). A gap analysis (`missing-features.md`) had been produced comparing this app against a competitor product ("Niketan"), listing 30 missing features in HIGH/MEDIUM/LOW priority.

This session closed **all 11 HIGH-priority gaps** (`missing-features.md` items #1–11) via a 16-task plan, executed sequentially: TDD (pure lib + unit test → schema/migration if needed → route + integration test → frontend wiring), one conventional commit per task, full-stack verification (typecheck + backend suite + frontend suite + build + DB-clean check) after every task before moving on.

**Repository is `pgkhata_v1`** — a Turborepo monorepo: `apps/web` (Next.js App Router), `apps/api` (Express 5), `apps/worker` (BullMQ, largely untouched this session), `packages/{auth,db,email,config,contracts,typescript-config}`. This is a **different codebase** from the Supabase/TanStack-Start app that `codebase-architecture.md`, `Database.md`, and most of `AI-work-log.md` describe — those documents are about a retired predecessor product, not this one. Do not use them as ground truth for `pgkhata_v1`.

---

## 2. Commits, in exact order

All on branch `main`, all pushed directly (no PR workflow was in use for this session — confirm current git remote state before assuming this is still the workflow).

| Task | Commit | Message | Migration? |
|------|--------|---------|------------|
| 1 | `60e52f1` | fix(auth): provision owner_profile on signup and repair the API build | no |
| 2 | `1567434` | feat(db): enforce billing idempotency, room uniqueness and financial-record retention | `0001` |
| 3 | `a653d78` | feat(web): group navigation into Operations, Money and Setup, and fix the mobile menu | no |
| 4 | `2508a2b` | feat(floors): add floors and group the property structure view by them | `0002` |
| 5 | `5e74000` | feat(beds): track individual beds and compute occupancy from them | `0003` |
| 6 | `6ab3787` | feat(tenants): assign tenants to beds, transactionally and race-safe | `0004` |
| 7 | `24bdade` | feat(rent-plans): configurable rent plans with a pure resolution order | `0005` |
| 8 | `56b4ceb` | feat(charge-types): configurable charge types, seeded per property | `0006` |
| 9 | `b1dd54e` | feat(billing): itemised line items, month-scoped electricity, transactional generation | `0007`, `0008` |
| 10 | `0efad31` | feat(billing): apply late fees as an idempotent line item | none |
| 11 | `d6825f9` | feat(advances): track advance payments and apply them through the ledger | `0009` |
| 12 | `5d2912a` | feat(deposits): track security deposit lifecycle and refunds | `0010` |
| 13 | `20f8c17` | feat(expenses): track spend with category-scoped owner approval | `0011` |
| 14 | `853acc1` | feat(tenants): gate self-registered signups behind owner approval | `0012` |
| 15 | `f50ff3e` | feat(dashboard): monthly trend, due rent, and outstanding aging | none |
| 16 | *(this doc)* | docs: session context handoff | none — `data-points/` is gitignored, this commit never happens |

To re-derive any task's full diff: `git show <commit>`. To see the whole session as one diff: `git diff 60e52f1^..f50ff3e`.

---

## 3. Database schema — current state as of commit `f50ff3e`

All 12 migrations (`0001`–`0012`) are applied to the live Neon database referenced by `DATABASE_URL`. Schema source of truth is `packages/db/src/schema.ts`; migrations live in `packages/db/drizzle/*.sql`.

### Tables added or changed this session

| Table | Change | Task | Key constraints |
|-------|--------|------|------------------|
| `floor` | new | 4 | `propertyId` → `property` CASCADE |
| `bed` | new | 5 | `roomId` → `room` CASCADE |
| `tenant` | `bedId` added, `tenant_bed_uq` partial unique index | 5/6 | one tenant per bed, partial so many tenants can hold no bed |
| `rent_plan` | new | 7 | `propertyId` → `property` CASCADE |
| `room` | `floorId`, `rentPlanId` added | 4/7 | both nullable, both RESTRICT on delete |
| `charge_type` | new | 8 | unique `(propertyId, code)` |
| `bill` | `lineItems` (jsonb), `voidedAt` added | 9 | `bill_amounts_nonnegative` CHECK |
| `advance_payment` | new | 11 | `tenantId` → `tenant` RESTRICT; CHECK `amount > 0`; CHECK `0 <= appliedAmount <= amount` |
| `security_deposit` | new | 12 | `tenantId`/`propertyId` RESTRICT; CHECK `amount > 0`; CHECK `0 <= refundAmount <= amount` |
| `expense_category` | new | 13 | unique `(propertyId, name)` |
| `expense` | new | 13 | `categoryId` → `expense_category` RESTRICT; CHECK `amount > 0` |
| `tenant` | `requestedRoomId`, `onboardingToken` added | 14 | `onboardingToken` UNIQUE |

**Deliberately not added:** `bill.promisedDate` (see §6, gap 2).

### FK deletion-rule pattern (load-bearing, apply consistently to any new table)

- Money/history tables (`bill`, `payment`, `advance_payment`, `security_deposit`, `expense`) reference `tenant`/`property` with **RESTRICT**, never CASCADE. The invariant: deleting a tenant or property must never silently erase financial history.
- Structural tables (`floor`, `room`, `charge_type`, `expense_category`) reference `property` with **CASCADE** — deleting the property is a real "give up this property" action and its structure should go with it.
- `tenant.bedId`, `tenant.requestedRoomId`, `room.floorId`, `room.rentPlanId` are all **nullable with SET NULL or RESTRICT** — a tenant/room can exist without these, they're optional relationships, not core identity.

### How to verify DB state right now

```powershell
pnpm --filter @pgkhata/db exec tsx scripts/inspect-constraint-readiness.ts
```
Expected clean baseline: `{ users: 1, owner_profiles: 1, properties: 0, floors: 0, rooms: 0, beds: 0, tenants: 0, bills: 0, payments: 0, readings: 0, complaints: 0 }` — one real signed-up user, everything else zero. If this shows other non-zero counts, something (likely a crashed test run) left orphaned data — see §7.

---

## 4. New pure calculation libraries (`apps/api/src/lib/`)

Every one of these is a pure function: no I/O, no DB access, fully unit-tested, imported by exactly one route file. This is the established pattern in this codebase — **any new business rule should be written this way first**, tested in isolation, then wired into a route as a thin I/O shell around it.

| File | Exports | Task | One-line rule |
|------|---------|------|----------------|
| `late-fee.ts` | `calculateLateFee({dueDate, lateFeePerDay, asOf, balance, voidedAt})` | 10 | Days overdue × rate; 0 if paid/voided/no rate; UTC day-granularity |
| `advance-payment.ts` | `availableBalance`, `applyAdvanceToBill` | 11 | Applying an advance never exceeds available balance or bill balance; status flips to "applied" only when fully consumed |
| `security-deposit.ts` | `outstandingLiability`, `issueRefund`, `summarizeLiability` | 12 | Refund can't exceed outstanding; status flips to "refunded" only when fully returned; liability report = fresh sum, never cached |
| `expenses.ts` | `decideExpense`, `summarizeExpenses` | 13 | Approve/reject is terminal (no re-deciding); totals only count approved rows, pending tracked separately |
| `tenant-approval.ts` | `decideTenantApproval`, `generateOnboardingToken` | 14 | Approve/reject is terminal; only a "pending" tenant can be decided |
| `dashboard-analytics.ts` | `daysOverdue`, `agingBucketFor`, `summarizeAging`, `buildMonthlyTrend` | 15 | Aging buckets always all 5 present even at zero; trend always fills every month in the window, zero-filling gaps |

Pre-existing pure libs (not touched this session, still load-bearing): `rent.ts` (`resolveMonthlyRent`), `beds.ts` (`bedLabel`/`reconcileBeds`), `assignment.ts` (`resolveBedForAssignment`), `billing-calculator.ts` (`calculateBill`), `due-date.ts` (`computeDueDate`), `electricity.ts` (`readingForMonth`).

**Recurring idiom across all of them:** a decision function returns a discriminated union — `{ok: true, ...}` or `{ok: false, reason: "specific-string"}` — never throws for a business-rule rejection. The route maps `reason` strings to HTTP error messages via a small `Record`. Follow this shape for any new decision logic.

---

## 5. Routes — full inventory of what's new or changed

Base URL for all owner-facing routes: `/v1/properties/:propertyId/...`, gated by `requireAuth, requireOwner, requireProperty` middleware (in that order, applied via `router.use(...)` at the top of each route file). `requireProperty` is what makes `req.propertyId` trustworthy — every query in every handler must filter by it; that's the entire authorization model in this app, there is no other tenant-isolation mechanism.

### Task 10 — `apps/api/src/routes/billing.ts` (existing file, one new endpoint)
- `POST /v1/properties/:pid/bills/apply-late-fees {billIds?, asOf?}` — strips any existing `LATE` line item, recomputes via `calculateLateFee`, re-appends if >0. Idempotent: re-running same day produces the same result, never doubles up.

### Task 11 — `apps/api/src/routes/advance-payments.ts` (new file)
- `GET /`, `GET /tenant/:tenantId`, `POST /`, `POST /:advanceId/apply {billId, amount?}`, `POST /:advanceId/forfeit`
- `/apply` is the important one: inserts a `payment` row with `method:"advance"`, then calls `syncBillTotals` (now exported from `payments.ts`) — **advances never write to `bill` directly; the payment ledger is the only source of truth for what's paid.** This is the single most important invariant in the whole payments subsystem — preserve it in any future work.
- **Retrofit fix in this task:** `payments.ts` `DELETE /:paymentId` had zero ownership check before this — any authenticated owner could delete any payment by id, cross-tenant. Fixed with an `innerJoin bill->tenant->propertyId` check. If auditing for authorization holes elsewhere, check every route for this exact pattern (a mutation that trusts an id param without joining back to `req.propertyId`).

### Task 12 — `apps/api/src/routes/security-deposits.ts` (new file)
- `GET /`, `GET /liability-report`, `GET /:depositId`, `POST /`, `POST /:depositId/refund {amount, date}`

### Task 13 — `apps/api/src/routes/expenses.ts` (new file)
- `GET/POST /categories`, `DELETE /categories/:categoryId`, `GET /`, `GET /summary`, `POST /`, `POST /:expenseId/approve`, `POST /:expenseId/reject`
- **Gotcha found here, applies anywhere a Postgres constraint violation needs to become an HTTP 409:** drizzle wraps the underlying pg driver error, so the SQLSTATE code is on `error.cause`, not on the caught error directly. A `pgErrorCode(error)` helper that walks the `.cause` chain (up to 5 levels) is the fix — see `apps/api/src/__tests__/helpers/pg-error.ts` for the same pattern already used in tests. Also: `ON DELETE RESTRICT` raises SQLSTATE `23001` (restrict_violation), not `23503` (foreign_key_violation) — check both if unsure which the FK was declared as.

### Task 14 — `apps/api/src/routes/tenants.ts` (existing file, new endpoints) + `apps/api/src/routes/public.ts` (existing file, behavior changed)
- New: `POST /:tenantId/{approve,reject,onboarding-link}`.
- **Behavior change, not additive:** `POST /public/signup/:token` used to create the tenant `active` and immediately assign a bed. Now creates `pending`, stores the requested room on `tenant.requestedRoomId`, assigns **no** bed. Bed-capacity enforcement moved from signup-time to approval-time (`approve` calls the same `assignTenantToBed` Task 6 built).
- New: `GET /public/onboarding/:token` — public, no auth, returns `{name, status, roomNumber, joiningDate}` for an approved tenant.

### Task 15 — `apps/api/src/routes/dashboard.ts` (existing file, three new endpoints)
- `GET /property/:pid/monthly-trend` — last 6 months `{month, collected, expenses}`.
- `GET /property/:pid/due-rent` — every tenant with `balance>0`, sorted most-overdue-first.
- `GET /property/:pid/outstanding-payment` — same balances, aging-bucketed.

---

## 6. Frontend — pages, hooks, types touched

Convention in this app: one hook file per domain in `apps/web/src/hooks/use-X.ts` wrapping `@tanstack/react-query`, one page per domain under `apps/web/src/app/(dashboard)/dashboard/X/page.tsx`, all types centralized in `apps/web/src/types/index.ts`. Nav source of truth is `apps/web/src/components/layout/nav-config.ts` — items can carry `upcoming: true` to render disabled/unlinked in the sidebar and mobile drawer.

New pages this session: `/dashboard/advance-payments`, `/dashboard/deposits`, `/dashboard/expenses`. Rewritten pages: `/dashboard/tenants` (pending-first sort, approve/reject actions), `/dashboard/properties/[propertyId]` (added trend chart + due-rent table + aging breakdown). New public page: `/public/onboarding/[token]`.

New hook files: `use-advance-payments.ts`, `use-security-deposits.ts`, `use-expenses.ts`. Extended: `use-tenants.ts` (approve/reject/onboarding-link), `use-dashboard.ts` (trend/due-rent/aging), `use-bills.ts` (apply-late-fees).

`StatusBadge` component (`components/dashboard/status-badge.tsx`) already had color mappings for `pending/approved/rejected/held/partial/refunded/forfeited/applied` from earlier tasks reused across domains — check this file before adding a new status string anywhere, it's very likely the color you need already exists.

`recharts` (`^3.8.0`) was already a pinned dependency, used for the first time this session in `components/dashboard/monthly-trend-chart.tsx`. **Type gotcha:** recharts v3's `Tooltip formatter` prop must return `[ReactNode, name]` or a bare `ReactNode`, not a plain string — check `node_modules/recharts/types/component/DefaultTooltipContent.d.ts` directly for the real signature if the type checker rejects a formatter, rather than guessing.

---

## 7. Test infrastructure notes (read before writing new integration tests)

- Pattern: `const describeDb = process.env.DATABASE_URL ? describe : describe.skip;` — integration tests only run when a real `DATABASE_URL` is present.
- Unique data per run: `const suffix = Date.now();` embedded in emails/property names. Phone numbers use a per-test-file base offset to avoid collisions across files run in the same session against the same live DB — this session used `9_500_000_000` (deposits), `9_600_000_000` (unused, reserved), `9_700_000_000` (tenant-approval), `9_800_000_000` (dashboard-analytics). **Use a new unused base for the next test file**, don't reuse one.
- Sign-up flow in tests: `POST /api/auth/sign-up/email`, then reuse the `set-cookie` header on subsequent requests.
- **Teardown must be scoped by `property_id` directly on every table that has one**, not derived by joining through `room`/`bed` — several tasks this session (12, 13) hit `RESTRICT` FK violations in `afterAll` because a test created a tenant or record without a room, and the teardown's join-based scoping missed it. Always: `where(eq(table.propertyId, owner.propertyId))` when the column exists, never `where(inArray(table.tenantId, tenantIdsThatWereFetchedViaRoomsOnly))`.
- `packages/db/scripts/cleanup-test-data.ts` — deletes all data for users whose email matches a `LIKE` prefix, in FK-safe order. Run this if a crashed test run leaves orphaned data (confirmed via `inspect-constraint-readiness.ts` showing non-zero counts). **This script itself has needed fixing twice this session** (Tasks 12, 13) because it fell behind new tables — if `inspect-constraint-readiness` still shows leftovers after running it, check whether the script deletes the newest tables (`advance_payment`, `security_deposit`, `expense`, `expense_category`) and whether it scopes tenants by `propertyId` directly rather than only via `roomId`.
- `apps/api/vitest.config.ts` has `testTimeout: 20000` — integration tests against the live Neon DB are slow; this is required, don't lower it.

### Full verification sequence used after every task (run all of these before considering any change "done")

```powershell
pnpm -r typecheck
cd apps/api; npx vitest run --reporter=basic   # expect 35 files / 324 passed + 3 skipped as of Task 15
cd apps/web; npx vitest run --reporter=basic   # expect 3 files / 30 passed
pnpm --filter web build
pnpm --filter @pgkhata/db exec tsx scripts/inspect-constraint-readiness.ts
```

---

## 8. Known gaps — RESOLVED (2026-08-31)

All 4 gaps from the original session have been resolved:

1. **✅ `useApplyAdvancePayment` UI** — Now wired into billing page with "Apply advance" button in expanded bill row. Dialog lets owner select advance and amount.
2. **✅ `bill.promisedDate`** — Built in 2026-08-31 session. `PATCH /:billId/promised-date` endpoint, `calculateLateFee` respects `promisedDate` parameter.
3. **⏳ `/dashboard/payments` nav item** — Still `upcoming: true`. Decision: leave disabled for now.
4. **✅ Manual tenant approval** — All tenant creation (manual and public signup) now creates `pending` status. Owner must approve from tenants list.

## 9. What's left, unstarted (MEDIUM/LOW priority)

From `missing-features.md` items #12–30, the following remain:

**Built in 2026-08-31 session:**
- ✅ #12: Bed Bookings — `bed_booking` table, CRUD + cancel + convert endpoints
- ✅ #14: Tenant Financial Reports — `GET /:tenantId/financial-report`
- ✅ #15: Checkout Financial Preview — `GET /:tenantId/checkout-preview`
- ✅ #16: Bed Transfer — `POST /:tenantId/transfer`
- ✅ #17: Invoice Voiding — `POST /:billId/void`
- ✅ #18: Promised Payment Date — `PATCH /:billId/promised-date`
- ✅ #19: Auto-Allocate Payments — `POST /auto-allocate`
- ✅ #23: CSV Import/Export — `GET /exports/tenants`, `/exports/expenses`
- ✅ #24: Outstanding Payment Drill-Down — `GET /outstanding-payment/details`
- ✅ #27: Emergency Contacts — `emergency_contact` table, CRUD endpoints
- ✅ #28: QR Code for Registration — `GET /:id/qr-code`

**Still remaining:**
- ⏳ #13: Tenant KYC Documents — needs file storage infrastructure (S3/R2)
- ⏳ #20: Staff Management — `staff` table created, needs role-based middleware
- ⏳ #21: Notification Preferences — needs notification infrastructure
- ⏳ #22: Billing Policy Configuration
- ⏳ #25: Property Amenities
- ⏳ #26: Admin Document Storage — needs file storage
- ⏳ #29: Modules & Permissions — blocked by #20
- ⏳ #30: Property Structure Import/Export

Read `missing-features.md` directly for the full spec of any of these before starting one.
