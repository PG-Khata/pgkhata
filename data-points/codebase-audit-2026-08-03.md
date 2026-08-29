# PG Manager Pro codebase audit

Audit date: 2026-08-03

Scope: the full `PG Manager Pro` inventory excluding installed dependencies and
generated build output, plus all existing files in `data-points`.

## Executive assessment

This is a substantial full-stack prototype, not only a frontend export. It has
real owner operations, database migrations, server functions, scheduled-job
code, billing logic, email integration, plan checkout, and a platform console.
It is not production-ready. The most important blockers are cross-owner
authorization, transactionality, job authentication/deduplication, unsupported
marketing promises, and the absence of automated tests.

## Architecture map

```text
Browser / TanStack Router
  |- public, auth, owner, blog, and console routes
  |- Supabase browser client for RLS-scoped CRUD
  `- TanStack server functions for privileged operations
        |- bearer JWT claim verification + CSRF middleware
        |- caller-scoped Supabase client
        `- service-role client for platform/jobs

Supabase
  |- Auth and MFA/AAL2
  |- PostgreSQL tables, RLS, helper functions, triggers, indexes
  |- Storage for tenant documents
  `- pg_cron/pg_net scheduled HTTP invocation

External services
  |- Resend for email
  `- Razorpay for owner subscription-plan checkout
```

## Route coverage

- Public: `/`, `/auth`, rent-agreement article, sitemap.
- Owner: dashboard, properties, rooms, tenants, tenant detail, readings, bills,
  payments, reports, plans/history, and settings.
- Platform: `/console` with MFA-gated administration and owner support views.
- Hooks: monthly bill generation and payment reminders.

## Positive controls already present

- Explicit CSRF middleware for server functions.
- Bearer claim verification before attaching caller context.
- Owner RLS across core operational tables.
- Private `SECURITY DEFINER` ownership helpers with reduced grants.
- Tenant/month unique bill index and conflict-safe monthly inserts.
- Scheduled bills default to unapproved.
- Platform actions require a live, enabled platform account and AAL2.
- Platform audit rows reject update/delete mutations.
- Razorpay signature comparison uses constant-time comparison.
- Reminder logic has same-day and three-day overdue guards in normal sequential
  execution.

## Critical findings

### 1. Cross-owner service-role operations

`generateMonthlyBills` and `sendPaymentReminders` require a valid owner session,
but then call service-role jobs that scan every admin. Any owner can therefore
create bills for other owners, trigger emails to other owners' tenants, and
receive cross-tenant result details.

Fix: either require `assertPlatformAdmin` for platform-wide jobs or pass the
authenticated admin ID into owner-scoped queries. Add cross-owner integration
tests.

### 2. Broken scheduled-billing authentication

The SQL cron migration sends a Supabase publishable `apikey` header. The route
accepts only `x-cron-secret` or Bearer authorization matching
`CRON_HOOK_SECRET`, so the scheduled call should return 401. No reminder cron
migration was found.

Fix: store the hook secret securely, align the request contract, remove
hardcoded project configuration from migrations where practical, and test the
deployed schedule end to end.

### 3. Non-atomic plan confirmation

Plan confirmation marks the payment row paid before updating settings and
history. If the later update fails, a retry can return early because the payment
already looks complete, leaving the owner on the old plan.

Fix: verify provider payment identity/status/amount, enforce unique provider
IDs, and apply payment, plan, and history changes in one transaction with a
retry-safe idempotency key.

## High findings

- Platform login-attempt recording and lockout lookup do not require
  authentication. Callers can manufacture failures or reset the consecutive
  failure chain, and direct Supabase sign-in bypasses the UI pre-check.
- Bill RLS checks that `property_id` is owned but does not prove `tenant_id`
  belongs to the same property. Enforce that relationship in the database.
- Reminder deduplication is check-then-send without a unique daily send key.
  Concurrent runs can duplicate email, and a failed log insert after a
  successful send permits future repeats.
- Razorpay confirmation validates the client-returned signature but does not
  fetch provider payment status/amount and has no webhook lifecycle.
- Deferred downgrades are stored but never applied. Plan limits are UI-only.
- There are no automated tests for RLS, jobs, billing, payments, or plans.

## Additional correctness and product findings

- Payment insertion and bill aggregation are separate browser operations, so a
  partial failure or concurrent writers can leave stale totals.
- Overpayment is accepted; the UI displays a balance clamped to zero.
- `partial` is used by one filter while the database status is
  `partially-paid`.
- A direct “mark paid” path can bypass creation of a payment-history row.
- Re-running a past-due bill with no payment can reset it to pending, and
  `paid_at` is not always synchronized.
- Draft bill electricity allocation can shift all room usage onto remaining
  unbilled tenants.
- Latest-reading derivation is limited to a 200-row query.
- Room capacity is displayed but tenant assignment does not visibly enforce it.
- Some bill, meter-reading, and payment deletions lack confirmation.
- KYC drag/drop lacks robust file-size/type checks; clearing the DB reference
  does not delete the Storage object. Bucket creation was not found in the
  migrations.
- Dynamic tenant/property values are inserted into email HTML without explicit
  escaping.
- Tenant phone is globally unique, which can conflict across independent
  owners.
- Some platform “total” metrics are derived from capped 1,000/2,000-row reads.
- Supporting-query errors in reminder processing can become silent skips.
- Naming is split across PGKhata, PG Manager Pro, PG Manager, Basera, and
  `basera.app`.

## Claim-to-code gaps

- Active tenant notification supports email, not WhatsApp/SMS.
- UPI QR/payment-link generation for tenant bills was not found.
- Tenant payments do not automatically reconcile from a payment provider.
- Backup/restore was not found despite landing/pricing references.
- The planned Neon/Drizzle/Better Auth stack is absent.
- “Production-ready,” “clean typecheck,” or similar transcript claims are not
  independently established by the current repository checks.

## Validation results

- Inventory: 166 project files; approximately 19,033 lines across 153
  TypeScript, TSX, SQL, and CSS source/schema files.
- Lint: 1,681 findings - 1,669 errors and 12 warnings. Most errors are Prettier
  formatting differences; warnings include React fast-refresh export rules.
- Build: not verified. Vite received `EPERM` while trying to write a temporary
  config file below `node_modules` in the sandbox.
- Tests: no test files, test script, or test runner found.
- Git history: none existed at audit time, so chat-reported implementation order
  and line-level authorship cannot be independently reconstructed.

## Recommended order of work

1. Restrict or scope platform-wide billing/reminder entry points.
2. Add a minimal integration-test harness and cross-owner RLS/auth test matrix.
3. Fix cron authentication and add a verified reminder schedule.
4. Make payment and plan transitions transactional and idempotent.
5. Add database constraints for bill/tenant/property consistency, nonnegative
   amounts, overpayment policy, and notification send keys.
6. Fix frontend correctness issues and destructive-action safeguards.
7. Choose and complete one real tenant delivery/payment path; correct marketing
   until it works.
8. Reconcile product branding and remove unsupported promises.
9. Decide whether to stabilize Supabase or migrate only after the core workflow
   has tests and real-owner validation.

## Evidence policy

The Claude and Lovable transcripts explain intent and AI involvement, but they
are not authoritative implementation evidence. Keep them unchanged. Update
this audit when a finding is fixed, and attach the validating test or live check
to the corresponding application commit.
