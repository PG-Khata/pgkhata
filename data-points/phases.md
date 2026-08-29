# PGKhata delivery phases

Last verified against source: 2026-08-03

This ordering follows the remediation order in `codebase-audit-2026-08-03.md`
and reconciles it with the MVP scope in `intention.txt`. It does not contradict
the audit; it adds the migration work that has since started and the business
gates the roast transcripts surfaced.

Two principles decide the order:

1. **Live cross-tenant defects come before everything.** Two of them exist
   today, one of which sends real email to other owners' tenants.
2. **The core loop from `intention.txt` is still not met.** The stated MVP bar
   is a tenant receiving an itemised bill with a working payment path.
   Delivery is email-only and payment reconciliation does not exist. Every
   phase after 2 is scope beyond a product that does not yet do its one job.

Each phase has an exit criterion and a gate. A phase is not done because the
code was written; it is done when the exit criterion is demonstrated.

---

## Phase 0 — Stop the cross-tenant bleeding

**Gate: start immediately. Nothing else is more urgent.**

These are live defects in code serving real accounts. Full evidence in
`security.md` S-1 through S-3.

1. **Scope or platform-gate the two service-role entry points.**
   `generateMonthlyBills` and `sendPaymentReminders` accept any authenticated
   owner and then operate across every account. The reminder path is the
   priority of the two: it sends real email to other owners' tenants and
   mutates their bills to `overdue`. Either require `assertPlatformAdmin`, or
   thread the authenticated admin id into every query.

2. **Rotate the committed Supabase key** in
   `20260801202733_*.sql`, and remove it from migration SQL.

3. **Align the cron authentication contract.** The job sends `apikey`; the hook
   requires `x-cron-secret` or Bearer. Scheduled billing has been silently
   401-ing since deployment. Parameterize the hardcoded `basera.app` URL.

4. **Add the missing reminder cron.** There is no schedule for `send-reminders`
   at all, despite the pricing page advertising it.

5. **Add a success signal for both schedules.** A scheduled job with no
   heartbeat is indistinguishable from one that never runs — which is exactly
   how this went unnoticed.

**Exit criterion.** An owner-authenticated call to either job affects only that
owner's data, proven by a test. Both cron schedules are observed firing
successfully in a deployed environment, not asserted from code.

---

## Phase 1 — Test harness and characterization

**Gate: Phase 0 fixes are written but not considered done until covered here.**

There are currently **zero tests in `apps/web`**, the code carrying all
production traffic. `apps/api` has five integration tests; `apps/worker`
declares a test script with no tests.

1. **Stand up the harness.** Vitest, Supertest, and Testcontainers for a real
   PostgreSQL. Copy the shape of `apps/api/tests/integration/app.test.ts` — the
   app factory with fake dependencies, asserting on the problem+json contract
   rather than just status codes.

2. **Cross-owner authorization matrix.** For every resource and every
   privileged job: owner A must not read, write, or trigger anything belonging
   to owner B. This is the test that should have caught Phase 0.

3. **Characterize before refactoring.** Pin current behavior of auth, tenant
   isolation, billing math, payment recording, and reminders — including the
   quirks. A characterization test documents what *is*, so a later refactor
   proves it did not change anything unintended.

4. **Regression tests for the Phase 0 fixes**, each failing before the fix.

**Exit criterion.** The cross-owner matrix runs in CI and fails if either
Phase 0 fix is reverted.

---

## Phase 2 — Close the core loop

**Gate: do not start until Phase 1's harness exists. Do not ship on an
unofficial WhatsApp bridge under any schedule pressure.**

This is the MVP bar from `intention.txt`: a PG owner goes from adding a tenant
to sending an itemised bill with a working payment path, in minutes, without
the tenant installing anything. It is not met.

1. **One real tenant delivery channel — official Meta WhatsApp Cloud API.**
   The self-hosted bridge is rejected; see `architecture.md` for why. Budget
   one to two days for template approval. Until it works, correct the marketing
   copy rather than leaving the claim standing.

2. **A payment path that reconciles.** A raw UPI QR cannot tell the system the
   tenant paid — UPI apps emit no webhook. Use a gateway that does. "Send a QR"
   and "know it was paid" are different problems, and only the second removes
   the owner's manual work.

3. **Fire bill notifications from the batch run.** Today they fire only from
   the single-tenant re-run path, so the monthly run notifies nobody.

4. **Escape HTML in email templates** (`security.md` S-7). Small, and blocking
   for anything customer-facing.

**Exit criterion.** A real PG owner, on real data, adds a tenant and sends a
bill that arrives on WhatsApp; the tenant pays; the system marks it paid
without the owner touching it.

**Business gates to answer before declaring this phase successful.** These come
from three independent reviews and are not rhetorical. Full reconciliation,
including which of their cost claims were wrong, is in `roast-review.md`.

- Does the owner *want* automated UPI collection, or does a cash-preferring
  owner want a PDF they forward themselves? Ask before building more
  automation on the assumption.
- Electricity sub-metering is inconsistent in real PGs — some have no
  sub-meter, some charge a flat rate. Does the billing model survive contact
  with that? Note the current code silently bills zero for electricity when an
  owner has no `settings` row.
- Would an owner pay the list price with no discount and no free trial?

**Costs verified 2026-08-03.** Direct Meta Cloud API at this volume is
₹17–₹345/month, not the ₹10–15k one review claimed — the safe choice is also the
cheap one. Start business verification early: unverified numbers are capped at
250 business-initiated conversations per 24 hours and cannot tier up. Use
Razorpay's "QR Codes" product, not "Smart Collect" — only the former supports
reusable static QRs with webhooks.

---

## Phase 3 — Data integrity

**Gate: do not start until Phase 2 proves the loop, or you will be hardening a
workflow nobody uses.**

Full detail in `error handling.md` L-1 through L-4 and `Database.md`.

1. **Make payment recording atomic and idempotent.** Today it is a
   browser-issued insert-then-aggregate with no transaction and no idempotency
   key. Remove the "mark paid" shortcut that writes `paid_amount` with no
   payments row.

2. **Make plan confirmation transactional.** It currently marks the payment paid
   *before* applying the plan and early-returns on retry, so a failure leaves
   the owner charged and un-upgraded.

3. **Add Razorpay provider verification and a webhook** (`security.md` S-5).
   Without a webhook there is no server-side source of truth for payment state.

4. **Move deduplication into the database.** Reminder dedup is check-then-act
   against a table with no unique key. Add the constraint.

5. **Check every query result.** The reminder run ignores four query errors; one
   failure mode disables dedup and causes duplicate sends.

6. **Add the missing constraints:** bill tenant/property consistency
   (`security.md` S-4), nonnegative amounts, an overpayment policy, and a
   unique key on `electricity_readings (room_id, reading_date)`.

7. **Fix the outbox before the first real processor lands** (`error handling.md`
   R-1 through R-8). The `jobId` collapse silently drops events; fixing it after
   real jobs flow means debugging lost work in production.

**Exit criterion.** Concurrent billing runs produce one bill per tenant-month.
Concurrent reminder workers produce one notification. A failed plan update rolls
back completely and retries safely.

---

## Phase 4 — Module migration

**Gate: do not start until Phase 3, and close the five new-backend gaps
(`security.md` N-1 to N-5) while there is only one module to retrofit.**

Strangler-fig, one module at a time, each test-first, each behind a feature
flag with legacy and API reads compared before writes switch over.

Order — dependencies first:

1. Identity and workspace authorization
2. Properties, rooms, tenants
3. KYC documents and electricity readings
4. Bills and payments
5. Reports and settings
6. Jobs and notifications
7. Plans and platform console

Before this phase can produce anything:

- **Generate the Drizzle migrations.** `packages/db/migrations` does not exist;
  the new schema has never been applied to a database.
- **Decide the destination for dropped columns.** `security_deposit` is money
  with no new home. `vacated_date`, `recorded_by`, `payment_link_url`, and the
  bill cycle dates are all load-bearing.
- **Port `settings`** or the billing engine has no configuration source.
- **Replace `handle_new_admin`** with application-code onboarding; Better Auth
  has no `auth.users` table for the trigger to attach to.

Also fold in the deduplication work: billing math is currently triplicated
across the batch run, the Bills page draft flow, and the single-tenant re-run,
with three copies of the cycle-date helpers. Migrating is the moment to collapse
them into one path.

**Exit criterion.** Each module's frontend reads and writes through `/api/v1`
with the legacy path removed, and the cross-owner matrix from Phase 1 passes
against the new implementation.

---

## Phase 5 — Data cutover

**Gate: do not start until every browser-side database call is gone. A partial
cutover with two live writers is the worst state available.**

Detail in `Database.md`.

1. **Rehearse on a copy.** Record counts, monetary totals, relationship
   integrity, object checksums.
2. **Reconcile `paid_amount` against `SUM(payments.amount)` *before* applying
   the `bills_amounts_valid` CHECK.** Legacy `paid_amount` is client-computed
   and may already disagree; applying the constraint first stalls the migration
   mid-flight on legitimate historical rows.
3. **Decide the backfill for NULL `due_date`** — new columns are NOT NULL with
   no default, so those rows fail the insert.
4. **Import identities without passwords.** Supabase bcrypt hashes cannot move.
   Every owner gets an expiring single-use activation link; platform admins
   re-enroll MFA.
5. **Copy storage objects** from `<admin_uuid>/` to
   `workspaces/<workspace_uuid>/`, verify by checksum, rewrite
   `tenants.address_proof_file_url` and `photo_url`, then switch signed-URL
   generation.
6. **Cut over during a brief write freeze**, validate reconciliation, keep the
   legacy system read-only for a defined rollback window.
7. **Remove Supabase clients, server functions, and migrations only after** the
   rollback window closes and production is verified.

**Exit criterion.** Record counts, monetary totals, and object checksums match.
The rollback window elapses without needing to use it.

---

## Phase 6 — Deferred

Nothing here starts before Phase 2 proves the core loop with paying owners.

- Multi-property polish (already generated, not validated with real owners)
- Database backup and restore, including a rehearsed restore drill — a backup
  that has never been restored is not a backup
- Recurring subscription lifecycle. Today nothing renews:
  `current_period_end` is set once by a DB default and never advances, and
  `pending_plan` downgrades are recorded but never applied
- Branding reconciliation across the five names in use
- SMS fallback

**Pricing and churn gate.** Before investing further in the subscription
machinery, test whether owners pay the intended price without a discount, and
what churn looks like at three months. Plan pricing is currently triplicated
across three files with no single source of truth — worth collapsing when this
work happens.

---

## Standing rules

**TDD.** Strict red-green-refactor for new backend behavior: a failing test
first, then the code. Migrated behavior needs a characterization test before
refactoring. Bug fixes need a regression test that fails before the fix.

Coverage: 80% lines/statements/functions/branches on the backend, 90% branch
coverage on auth, billing, payments, and job idempotency. Frontend-wide strict
TDD is not required initially; frontend changes need contract tests and critical
smoke coverage.

CI blocks merge unless format, lint, typecheck, tests, migration checks, and
builds pass.

**Honesty.** Every feature carries a status label — Verified, Partial, Planned,
Not implemented. Marketing copy is corrected when it outruns the code, not when
the code catches up. AI chat output is never treated as proof.

**Commits.** Only inside `PG Manager Pro`. Never `data-points`, never `.env`.
One logical change per commit.
