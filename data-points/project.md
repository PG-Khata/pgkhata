# PG Manager Pro / pgkhata.com - audited project brief

Last audited: 2026-08-03

## Product purpose

PG Manager Pro is an owner-facing application for PG and hostel operations. Its
core loop is property and room setup, tenant records, electricity readings,
monthly bills, payment recording, and collection tracking. Tenants do not have
an application account.

The founder's intended product name is `pgkhata.com`. The downloaded code still
uses `PG Manager Pro`, `PG Manager`, `Basera`, and `basera.app` in different
places. Branding is therefore not yet reconciled.

## Repository boundary

```text
D:\Projects\Pg_Manager\
|- data-points\       research and working notes; do not commit
`- PG Manager Pro\    application repository; commit only this folder
```

At audit time there was no Git repository in either folder. Git should be
initialized inside `PG Manager Pro`, never at the workspace root. Local `.env`
files must remain ignored.

## Implemented stack - verified from the code

| Layer | Current implementation |
| --- | --- |
| Application framework | TanStack Start and TanStack Router |
| UI | React 19, TypeScript, Tailwind CSS 4, Radix/shadcn-style components |
| Build/runtime tooling | Vite 8 and Bun scripts |
| Data and authentication | Supabase Auth, PostgreSQL, Storage, generated DB types |
| Server operations | TanStack server functions and route handlers |
| Data fetching | Supabase client and React Query |
| Email | Resend HTTP API |
| Subscription checkout | Razorpay order creation and signature verification |
| Scheduled work | Supabase `pg_cron`/`pg_net` migrations plus protected HTTP hooks |
| PDF | jsPDF and jspdf-autotable |

The proposed Node.js, Neon, Drizzle, Better Auth, Pino, Redis, and BullMQ
migration has not started. Those packages and implementations are not present
in the current application.

## Implemented product areas

- Public landing page, authentication page, rent-agreement article, and
  sitemap.
- Owner dashboard with occupancy and collection summaries.
- Multi-property, room, and tenant CRUD.
- Tenant KYC document upload through Supabase Storage.
- Electricity readings and per-room consumption tracking.
- Monthly rent/electricity bill generation with a unique tenant-month guard.
- Scheduled bills that wait for owner approval and manual bill reruns.
- Bill PDF download and monthly PDF batch download.
- Manual payment ledger with paid, partial, pending, and overdue status updates.
- Email bill notifications and scheduled email payment reminders.
- Reports and tenant-level bill/payment history.
- Plan display, prorated upgrades, deferred-downgrade recording, Razorpay
  checkout, and plan history.
- Owner branding, billing, reminder, density, and theme settings.
- Separate platform console with owner directory, metrics, support notes,
  plan overrides, AAL2/MFA checks, and append-only audit rows.
- Owner isolation through PostgreSQL row-level security and private ownership
  helper functions.

## Partial or not implemented

These should not be promised as working production features yet.

| Capability | Audited status |
| --- | --- |
| WhatsApp/SMS bill delivery | Settings/schema exist, but the active notification path sends email only. |
| Tenant UPI QR/payment link | A bill column and marketing copy exist; generation/delivery was not found. |
| Automatic tenant payment reconciliation | Not found. Owner payment recording is manual. |
| Database backup and one-click restore | Not found, despite pricing/marketing references. |
| Reliable scheduled monthly billing | Billing engine exists, but the SQL cron sends a header the endpoint does not accept. |
| Scheduled reminders | Endpoint exists; no matching reminder cron migration was found. |
| Recurring subscriptions | No Razorpay subscription/webhook lifecycle was found. |
| Applying pending downgrades | `pending_plan` is stored, but no renewal job applies it. |
| Server-enforced plan limits | UI gates exist; server/database enforcement was not found. |
| Automated tests | No test files, test runner, or test script were found. |
| Neon/Drizzle/Better Auth migration | Planned only; no implementation found. |

## Current data model

The generated Supabase types contain 17 public tables:

- Operations: `admins`, `properties`, `rooms`, `tenants`,
  `electricity_readings`, `bills`, `payments`, `settings`.
- Messaging: `notification_logs`, `notification_templates`.
- Commercial: `plan_change_history`, `plan_payments`.
- Platform administration: `user_roles`, `super_admins`,
  `super_admin_audit_log`, `super_admin_login_attempts`,
  `owner_support_notes`.

The principal ownership chain is admin -> property -> room -> tenant. Bills
reference both a tenant and property; payments reference a bill.

## Highest-priority engineering risks

1. Any authenticated owner can currently invoke two server functions that use
   the service role to generate bills or send reminders across every owner.
   Scope these operations to the caller or require a platform administrator.
2. The monthly cron uses an `apikey` header, while its route requires
   `x-cron-secret` or Bearer authorization. Align the contract and add the
   missing reminder schedule.
3. Payment aggregation, bill updates, and plan confirmation span multiple
   non-transactional writes. Move invariants into database transactions,
   functions, or triggers and make retries idempotent.
4. The plan payment can be marked paid before the owner plan update succeeds.
   A retry can then report success without applying the plan.
5. The platform login-attempt endpoints can be called without authentication,
   allowing lockout manipulation; the UI pre-check is not a security boundary.
6. Bill ownership policy checks the property but does not prove the referenced
   tenant belongs to that property.
7. Reminder deduplication is check-then-send without a database uniqueness
   constraint, so concurrent runs can send duplicates.
8. Payment UI and database rules permit overpayment; several destructive
   actions lack confirmation.
9. KYC drag/drop lacks reliable size/type validation and clearing a reference
   does not remove the stored object.
10. Marketing, pricing, and naming do not consistently match implemented
    behavior.

Detailed evidence and additional findings are in
`codebase-audit-2026-08-03.md`.

## Verification snapshot

- Scope inspected: 166 repository files; 153 TypeScript/TSX/SQL/CSS source and
  schema files totaling about 19,033 lines, excluding dependencies/build output.
- Lint: failed with 1,681 findings (1,669 errors and 12 warnings); most errors
  are Prettier formatting findings.
- Build: attempted, but the sandbox denied Vite permission to write its
  temporary config under `node_modules`; this is not a successful build result.
- Tests: none found, so no automated behavioral test result exists.
- Raw Claude and Lovable transcripts are context, not verification. Claims in
  those transcripts must be checked against source before reuse.

## Proposed future stack - decision not implementation

The founder has considered Node.js, TypeScript, Neon PostgreSQL, Drizzle,
Better Auth, Pino, Redis, and BullMQ. Before starting a rewrite, first decide
whether migration value exceeds the cost of stabilizing the existing TanStack
Start/Supabase system. The product model and security invariants should be
specified and tested before changing infrastructure.

## Working and commit rules

- Commit only inside `PG Manager Pro`; never include `data-points`.
- Never commit `.env`, credentials, service-role keys, API tokens, or private
  customer data.
- Use one logical change per commit with `feat:`, `fix:`, `docs:`, `test:`,
  `refactor:`, or `chore:` prefixes.
- Keep AI-generated claims labeled until verified by code, tests, or a live
  integration check.
- Fix authorization and data-integrity risks before adding more product scope.
