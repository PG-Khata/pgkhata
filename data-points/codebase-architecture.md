# PGKhata / PG Manager Pro — Codebase Architecture

> **Generated from static repository analysis:** 2026-08-27  
> **Primary application:** `apps/web` (`@pgkhata/web`)  
> **Scope:** source code, configuration, migrations, and visible tests in this checkout. No production database, provider dashboard, deployment configuration, or real secrets were accessed.

## 1. Executive summary

PGKhata is a multi-tenant operations product for Indian PG and hostel owners. An owner can maintain properties, rooms, tenants and KYC records; log electricity readings; produce monthly rent/electricity bills; record collections; send payment reminders; expose tenant self-signup and complaint links; and manage their PGKhata plan. A separate internal platform console supports super-admin operators.

This is **not** a conventional frontend plus a separate `apps/api` backend. The shipping code is one SSR/full-stack application in `apps/web`:

- **Frontend:** React 19, TanStack Router, TanStack Query, Tailwind CSS 4, Radix-style UI components.
- **Full-stack boundary:** TanStack Start server functions and file-based server handlers, packaged through Vite and Nitro.
- **Data/auth:** Supabase Auth + Postgres + Row-Level Security (RLS). The browser performs many owner-scoped CRUD operations directly through Supabase under RLS.
- **Privileged backend work:** server-only modules use Supabase's service-role key for cron jobs, external webhooks, platform administration, public token flows, email, and WhatsApp delivery.
- **Payments:** Razorpay orders, browser checkout callback, and an authoritative signed Razorpay webhook.
- **Messaging:** Resend email and optional Meta WhatsApp Cloud API.

The repository preserves a pnpm workspace shape for future deployables, but `pnpm-workspace.yaml` currently includes only `apps/*` and the active deployable is `apps/web`. The README explicitly states that an earlier Express/Drizzle/BullMQ backend was removed. Existing directories such as `apps/api`, `apps/worker`, `packages/db`, `packages/contracts`, and `packages/config` do not contain active source/package manifests in this checkout; they must not be documented as running services.

## 2. Repository map

```text
PG Manager Pro/
├── apps/
│   └── web/                         # only active deployment/application
│       ├── src/
│       │   ├── routes/               # TanStack file-based pages and HTTP hooks
│       │   ├── components/           # shared owner, marketing, console and UI components
│       │   ├── integrations/supabase/# browser, authenticated-server and service-role clients
│       │   ├── lib/                  # business logic, server functions, service modules
│       │   ├── start.ts              # CSRF, global server-function auth attachment/error handling
│       │   ├── server.ts             # SSR/Nitro entry and catastrophic-error normalization
│       │   └── router.tsx            # QueryClient and router creation
│       ├── supabase/migrations/      # schema, RLS, triggers, cron and subscription evolution
│       ├── tests/                    # 13 Node/Vitest test files
│       ├── vite.config.ts            # Vite + Start + Nitro + Tailwind configuration
│       └── package.json
├── data-points/reference-backend/    # reference-only retired backend design artifacts
├── package.json                      # workspace commands; Node >=22 <25; pnpm 10.15.1
├── pnpm-workspace.yaml               # apps/* only
└── .env.example                      # required and optional environment variables
```

## 3. Runtime architecture and request paths

```text
Browser
  ├─ public marketing/auth/public-link pages
  ├─ owner app routes (client-rendered beneath /_authenticated)
  └─ platform console (/console)
       │
       ├─ Direct Supabase browser client (publishable key + RLS)
       │    └─ owner CRUD: properties, rooms, tenants, readings, bills, payments, settings, etc.
       │
       └─ TanStack Start server functions (Bearer session token attached globally)
            ├─ authenticated RLS client: verifies Supabase claims, then performs owner-scoped work
            └─ service-role modules: trusted jobs/integrations, with explicit ownership filters
                   ├─ monthly billing and reminders
                   ├─ Razorpay orders/payment application
                   ├─ Resend / Meta WhatsApp
                   ├─ tenant signup and complaint token flows
                   └─ platform-console administration

External callers
  ├─ pg_cron / pg_net → signed cron hooks → bills, reminders, plan lifecycle
  ├─ Razorpay → raw-body HMAC webhook → idempotent plan activation
  └─ Meta → challenge/status webhook → notification-log delivery state

Supabase
  ├─ Auth identity and browser sessions
  ├─ Postgres relational data, constraints, triggers and RLS
  └─ storage references for tenant photo/KYC URLs
```

### Application boot and rendering

- `src/router.tsx` creates a new React Query `QueryClient` and TanStack router, enables scroll restoration, and uses `defaultPreloadStaleTime: 0`.
- `src/start.ts` explicitly reinstalls CSRF middleware for server functions because defining a custom Start entry disables Start's implicit default. It also registers client middleware that attaches the current Supabase access token to server-function calls and a global server error handler that returns a custom HTML error page for unhandled failures.
- `src/server.ts` wraps TanStack Start's generated server entry. It turns thrown SSR errors, including h3's swallowed JSON `HTTPError` 500s, into the same user-facing HTML error response.
- `vite.config.ts` loads the root `.env` into `process.env` for Nitro/server code without overriding real host environment values. Vite still exposes only `VITE_*` variables to browser code. It also deliberately separates Supabase-related browser code into a chunk so public marketing visitors do not download it unnecessarily.

## 4. Frontend design

### Shared client patterns

The client side is a React single-page experience organized by TanStack file routes. React Query loads and mutates data; successful mutations invalidate named query keys such as `properties`, `rooms`, `tenants`, `overview`, `bills`, and `settings`. Most operational screens call the browser Supabase client directly. RLS is therefore a core authorization boundary, not merely a database convenience.

Shared UI infrastructure includes `AppSidebar`, owner and console layouts, marketing navigation/footer, `PropertyScopeProvider`/switcher, plan-status banner and plan gates, responsive virtualized tables, filters, search debounce, pagination, density controls, dialogs, file upload UI, themed primitives, Sonner notifications, CSV exports, and jsPDF-based bill/receipt exports.

### Public and marketing routes

| Route or group                                                                       | Purpose                                                                                                                                 |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                                                                  | Marketing landing page for the owner product.                                                                                           |
| `/auth`                                                                              | Email/password sign-in, signup, Google OAuth, and password-reset request. Uses neutral reset/signup copy to reduce account enumeration. |
| `/reset-password`                                                                    | Password reset completion.                                                                                                              |
| `/contact-us`, `/privacy`, `/terms`, `/shipping-policy`, `/cancellation-and-refunds` | Public/support and legal content.                                                                                                       |
| `/signup/$token`                                                                     | Public tenant self-signup form backed by the token-only API flow.                                                                       |
| `/complaint/$token`                                                                  | Public tenant complaint form backed by the token-only API flow.                                                                         |
| `/robots.txt`, `/sitemap.xml`                                                        | SEO controls; deployment guidance distinguishes public `www`, app, and admin hosts.                                                     |

### Owner application (`/_authenticated/*`)

The `_authenticated` layout has `ssr: false`, dynamically loads the browser Supabase client, requires an authenticated Supabase user, redirects platform users to `/console`, and sends owners whose plan status is `unpaid` or `cancelled` to `/plan`. It supplies the sidebar, property scope, branding, theme control, plan banner, and responsive page shell.

| Route               | Feature and implemented behavior                                                                                                                                                                                                                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/dashboard`        | Current-month collection/occupancy metrics, all-month overdue bills, open complaint count, scheduled/personal reminder visibility, WhatsApp quota, room occupancy, and collection-status summary. The property selector scopes owner views.                                                                                                                                     |
| `/properties`       | Property CRUD with address/city, flat or meter electricity mode, optional per-property electricity-rate override, plan limit UI, and per-property tenant-signup/complaint share links that can be regenerated or disabled.                                                                                                                                                      |
| `/rooms`            | Room CRUD with property, number, type, capacity, rent, optional size, live active-tenant occupancy and plan cap UI. Room number is unique inside a property.                                                                                                                                                                                                                    |
| `/tenants`          | Tenant/KYC CRUD: Indian phone validation, email validation, room assignment, status, joining/vacating dates, deposit, rent override, address, emergency contacts, address proof and photo URLs, notes, search, status filters and pagination. Vacating releases capacity and excludes future bill runs while retaining historical records.                                      |
| `/tenant/$tenantId` | Tenant ledger: bills, bill components, balance, payments, payment removal/recalculation, record-payment action and Scale-gated PDF invoice download.                                                                                                                                                                                                                            |
| `/readings`         | Room meter-reading history. Rejects negative readings and decreases from the room's latest value. Records units since prior reading, the effective rate, and calculated amount. First reading is a baseline.                                                                                                                                                                    |
| `/bills`            | Monthly billing month selector, draft/review workflow, manual immediate billing run, bill filtering, scheduled-run approval, individual/batch bill sending, payment shortcut, deletion, invoice/PDF operations and tenant rerun dialog. Drafts split room electricity among active occupants and allow edits before issue. Scheduled drafts stay unapproved until owner review. |
| `/payments`         | Cross-month due collection view, paid/partial/overdue filters, ledger-based payment recording, recent payments, CSV export (Growing+), scheduled reminders, immediate due-date reminder run, and manual email/WhatsApp reminder actions.                                                                                                                                        |
| `/reports`          | Scale-gated collection analytics: selected-month billed/collected/outstanding/overdue values, collection rate, per-property breakdown, six-month trend and CSV export.                                                                                                                                                                                                          |
| `/complaints`       | Owner complaint queue from public per-property links, search/filter, detail dialog and `open` → `in-progress` → `resolved` status update.                                                                                                                                                                                                                                       |
| `/settings`         | Owner profile, electricity/due-date/reminder defaults, optional owner UPI VPA/payee name, WhatsApp enablement and quota display, and sign-out. UPI is for tenant-to-owner rent collection and is distinct from PGKhata's Razorpay account.                                                                                                                                      |
| `/plan`             | Current subscription state, coupon redemption for unpaid accounts, monthly/annual presentation, prorated upgrade checkout, scheduled downgrade, renewal checkout, plan comparison and feature gates. Razorpay script loading is client-side; verification is server-side.                                                                                                       |
| `/plan-history`     | Owner-visible subscription history, charge/credit data, receipt dialog and downloadable plan PDFs.                                                                                                                                                                                                                                                                              |

### Internal platform console (`/console`)

The console is an independent no-index, client-rendered operator surface. It first requires an authenticated user, then `super_admins` membership, then enrolled and satisfied TOTP MFA. Its sections include overview metrics, owner directory, coupons, MRR/revenue, adoption/usage, health, append-only audit history, broadcast panel, and console-security settings. The normal owner layout explicitly redirects qualifying platform users away from owner routes.

## 5. Backend implementation model

### Three Supabase access levels

1. **Browser publishable-key client** (`src/integrations/supabase/client.ts`) persists/refreshes browser sessions and uses RLS for owner CRUD.
2. **Authenticated server-function client** (`auth-attacher.ts`, `auth-middleware.ts`) adds `Authorization: Bearer <access token>` from the browser session. The server middleware validates the Bearer shape, calls `auth.getClaims`, and creates a per-request publishable-key client retaining that identity/RLS context.
3. **Service-role client** (`client.server.ts` or server helpers) bypasses RLS. It is server-only and must explicitly scope queries to a verified owner/property chain. It is used for cron jobs, public token handlers, webhooks, delivery integrations, and platform actions.

### Server functions and HTTP handlers

Business actions are generally split between `*.functions.ts` (TanStack Start server-function wrappers) and `*.server.ts` (server-only implementation). Public incoming HTTP hooks are TanStack file routes under `src/routes/api/public/hooks`.

| Endpoint                                      | Authentication / trust                                                                | Behavior                                                                                                                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/public/hooks/generate-bills`       | `x-cron-secret` or `Authorization: Bearer <CRON_HOOK_SECRET>`                         | Validates optional `YYYY-MM`; runs platform-wide monthly billing with `approved: false`, so owner approval is needed before tenant notification.                                  |
| `POST /api/public/hooks/send-reminders`       | Cron secret                                                                           | Runs due-date payment reminders, and then sweeps due owner-scheduled reminders unless `dryRun`. Optional validated date/dry-run body.                                             |
| `POST /api/public/hooks/plan-lifecycle`       | Cron secret                                                                           | Nightly plan lifecycle sweep; transitions accounts once their post-renewal payment buffer expires.                                                                                |
| `POST /api/public/hooks/razorpay`             | Razorpay `x-razorpay-signature`, exact raw request body, dedicated webhook secret     | Authoritative capture/order-paid confirmation; idempotently applies plan payment. Records failed events without overwriting already-paid records.                                 |
| `GET/POST /api/public/hooks/whatsapp`         | GET: Meta verification token. POST: currently **no Meta app-secret HMAC validation**. | GET echoes the challenge when token/mode match. POST parses delivery statuses/inbound messages and updates notification logs by provider message ID.                              |
| `GET/POST /api/public/hooks/tenant-signup`    | Active unguessable property signup token                                              | GET returns only property name and vacant room number/id choices. POST derives property/admin from the token, validates input/server-side capacity, and creates an active tenant. |
| `GET/POST /api/public/hooks/complaint-submit` | Active unguessable property complaint token                                           | GET returns property name. POST derives property/admin from token, validates input and writes an owner-visible complaint.                                                         |

## 6. Core domain flows

### 6.1 Monthly billing

`runMonthlyBilling(month, { approved, adminId })` in `src/lib/billing-run.server.ts` is the central batch process.

1. It walks the ownership chain `admin → property → room → tenant`. If `adminId` is supplied (owner-initiated path), every dependent query is restricted to that owner; only the cron hook omits it.
2. It retrieves settings, bills already present for the month, and cycle readings.
3. It includes only tenants with `status = active`.
4. It sums positive electricity units per room for the cycle and divides units evenly among active tenants in that room.
5. Rent uses `tenant.monthly_rent_override`, falling back to `room.monthly_rent`. Electricity rate uses `property.electricity_rate_per_unit`, falling back to owner settings. Due date is the cycle end plus owner `due_date_offset_days`.
6. It creates rows with a `(tenant_id, bill_month)` conflict key and `ignoreDuplicates`. Existing rows are prefiltered and the unique constraint protects concurrent/retry cases, making the operation idempotent.
7. Manual runs create approved bills and notify created tenants. Cron runs deliberately create unapproved drafts, which must be owner-approved in `/bills` before reminders/invoices proceed.

### 6.2 Payments and ledger reconciliation

`payments` are the source of truth. The `recordPayment`, `deletePayment`, and `syncBillTotals` helpers derive `bills.paid_amount`, `paid_at`, and status from the sum of payment rows. The UI deliberately does not mark a bill paid by setting only bill columns because that would diverge from the ledger and be erased at the next ledger sync. Payment statuses are displayed as paid, pending, partially paid, or overdue based on balances and dates.

**Current product limitation:** owner UPI links direct money from a tenant to that owner's own bank/VPA. There is no tenant-rent payment webhook or automatic reconciliation, so an owner records these payments in the ledger.

### 6.3 Reminders and scheduled follow-ups

`runPaymentReminders` evaluates approved bills with a balance and due date. It selects before-due, due-date, or overdue content from owner settings; marks past-due bills overdue; prevents same-day duplicates through successful `notification_logs`; and uses a three-day overdue cooldown. Email sends use Resend when configured. Optional WhatsApp sends require enabled owner settings, valid tenant phone, provider configuration, and plan quota.

Owner manual bill reminders are deliberately different: they skip date/dedup gates but drop cross-owner IDs server-side. Owner-scheduled reminders are stored in `scheduled_reminders`; nightly processing sends only rows with selected channels. Personal reminders have no channel and remain owner dashboard items until dismissed.

### 6.4 Plan checkout and activation

Subscription money flows through PGKhata's Razorpay account, not through an owner's UPI VPA.

1. Server code uses `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` to create an order and stores a `plan_payments` record.
2. The browser opens Razorpay Checkout. The success callback invokes a server function that validates `orderId|paymentId` HMAC using the API key secret.
3. Razorpay also calls the raw-body webhook using the separate `RAZORPAY_WEBHOOK_SECRET`; this is the durable/authoritative path if the browser closes.
4. `applyPaidPayment` atomically claims the payment row with `status != paid`, so a simultaneous browser callback and webhook result in exactly one applied state transition. The losing path is a safe no-op.
5. Renewal advances the plan period and may apply a scheduled downgrade; upgrade preserves billing cadence/period and records daily proration. Both write plan history. If application fails after capture, the claim is released so webhook retry can repair activation.

### 6.5 Public tenant links

Each property can have one active signup token and one active complaint token. Public routes never trust client-supplied property/admin identifiers. They resolve the token server-side with the service-role client and disclose only necessary data: public signup exposes property name and vacant room labels, not rent or capacity details; complaints use free-text room number to avoid exposing property inventory.

## 7. Database and multi-tenancy

### Foundational ownership chain

```text
Supabase auth.users
  └─ admins (one owner profile)
       └─ properties
            └─ rooms
                 └─ tenants
                      ├─ bills
                      │    └─ payments
                      └─ notification_logs
```

The signup trigger creates `admins` and `settings` for ordinary Auth users. Super-admin identities are explicitly excluded from the owner workspace. RLS is enabled for the business tables. `SECURITY DEFINER` ownership helpers (`owns_property`, `owns_room`, `owns_tenant`, `owns_bill`) anchor policies on dependent rows. Direct owner CRUD is thus restricted by the ownership relationship, while the service role bypasses RLS and must perform equivalent filtering in code.

### Tables and responsibilities

| Area                    | Tables / significant state                                                                                                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Owner identity          | `admins`; `settings` holds billing/reminder, UPI, WhatsApp, branding and plan state.                                                                                                                                           |
| Physical inventory      | `properties`, `rooms`, `electricity_readings`. Property delete cascades rooms and bills. Room deletion is restricted while tenants exist. Room number is unique per property.                                                  |
| Tenants/KYC             | `tenants`: contact data, room, joining/vacating, deposit, rent override, proof/photo URLs, status and notes. Tenant phone is globally unique.                                                                                  |
| Billing/collection      | `bills` (unique by tenant/month, amount components, cycle, approval, balance/status), `payments`, `notification_logs`, `notification_templates`.                                                                               |
| Owner reminder work     | `scheduled_reminders`, including pending/sent/cancelled lifecycle, optional tenant/bill/channel and personal-note rows.                                                                                                        |
| Public property links   | `property_signup_links`, `property_complaint_links`, `complaints`. Tokens are unique, active/inactive, and owner-RLS protected.                                                                                                |
| Subscription/billing    | Plan columns on `settings`; `plan_payments`, `plan_change_history`, `coupons`, `coupon_redemptions`. Coupon tables are not directly readable by authenticated owners; `redeem_coupon` is a scoped `SECURITY DEFINER` function. |
| Platform administration | `super_admins`, `super_admin_audit_log`, `super_admin_login_attempts`, support-note/role records introduced by later migrations. Audit rows are append-only: an update/delete trigger raises an exception.                     |

### Plan limits and database enforcement

The UI pre-checks plan limits, but migration `20260814190100_server_side_plan_limits.sql` also adds database triggers. These prevent direct client inserts from exceeding property, total-room, or Starter active-tenant capacity limits. The reviewed limits are Starter: 1 property and 15 rooms; Growing: 5 properties and 40 rooms; Scale: 15 properties and 200 rooms; enterprise/other is unbounded by these trigger branches. Starter tenant capacity is the sum of room capacity rather than a fixed tenant count.

### Migration caveat

The migrations are chronological alterations rather than one consolidated canonical DDL file. This document consolidates the foundational schema and explicitly reviewed later additions. For an exact production column/policy inventory, replay/reconcile all migrations against the deployed Supabase project and inspect its current schema/RLS state.

## 8. Security controls and observed gaps

### Controls present

- Supabase RLS covers owner data; browser uses a publishable key only.
- Server functions attach a current access token and validate claims before obtaining an RLS-bound server client.
- `start.ts` applies CSRF middleware to server functions.
- Service-role usage is documented and reviewed with explicit owner/property filtering in billing/reminder paths; cross-owner isolation tests exercise this.
- Cron hooks require `CRON_HOOK_SECRET` via custom header or Bearer form.
- Razorpay checkout HMAC and raw-body webhook HMAC use different secrets; comparison is length-safe/constant-time.
- Payment application has a row-level atomic claim to avoid browser/webhook double activation.
- Public signup/complaint workflows derive authority from the active token rather than client property/admin input and validate content again server-side.
- Coupon codes are not exposed through direct authenticated reads; redemption is an authenticated database function that checks active/expiry/redemption limits.
- Platform console requires membership, TOTP enrollment, and MFA assurance. Platform audit data is append-only.
- Auth reset/signup messages avoid telling a caller whether an email account exists.

### Known limitations / follow-up risks

1. **WhatsApp POST authenticity gap:** `api/public/hooks/whatsapp.ts` intentionally does not verify `X-Hub-Signature-256`, because `WHATSAPP_APP_SECRET` is not configured. Anyone able to reach the endpoint can potentially submit a syntactically valid status payload. Add app-secret configuration and raw-body HMAC validation before treating delivery status as authoritative.
2. **No tenant rent payment webhook:** UPI payment links send money directly to property owners and reconciliation is manual.
3. **Provider/deployment state not verified:** actual Supabase policies/migration application, `pg_cron` settings, host environment variables, Razorpay dashboard event configuration, Resend domain verification, WhatsApp approval/configuration, and Vercel runtime configuration are outside this repository analysis.
4. **Operational service-role discipline:** RLS does not protect service-role routines. New privileged code must continue the established explicit ownership-filter pattern and add isolation tests.
5. **Exact database state:** migration history was inspected statically and not replayed against production.

## 9. External services and required configuration

| Service                 | Purpose                                          | Key configuration                                                                                                                                |
| ----------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Supabase                | Auth, Postgres, RLS, storage references          | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, server `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.            |
| Razorpay                | PGKhata subscription orders/refunds and webhooks | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, separate `RAZORPAY_WEBHOOK_SECRET`.                                                                    |
| Resend                  | Bill/reminder email                              | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`; delivery is skipped rather than made fatal if not configured.                                             |
| Meta WhatsApp Cloud API | Optional template reminder delivery and statuses | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`; production should also add an app secret for webhook verification. |
| pg_cron + pg_net/http   | Scheduled HTTPS calls                            | DB-configured base URL and `app.cron_hook_secret`; `.env.example` describes monthly billing, daily reminders and daily plan lifecycle.           |

The environment template recommends distinct hosts: `www.pgkhata.com` for indexable marketing, `app.pgkhata.com` for owner operations, and `admin.pgkhata.com` for internal operations. Session cookies do not cross hosts; cross-host links must be absolute. App/admin robots responses should disallow indexing.

## 10. Build, quality and test coverage

### Commands

```powershell
# repository root (requires Node >=22 <25 and pnpm 10.15.1)
pnpm install
pnpm dev
pnpm check

# individual workspace checks
pnpm --filter @pgkhata/web lint
pnpm --filter @pgkhata/web typecheck
pnpm --filter @pgkhata/web test
pnpm --filter @pgkhata/web build
```

Root `pnpm check` runs Prettier verification, lint, TypeScript check, tests and build. The web package uses ESLint, `tsc --noEmit`, Vitest in Node mode (`tests/**/*.test.ts`), and Vite/Nitro build output.

### Visible test coverage

| Tests                                                                                      | Behavior covered                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `billing-ledger.test.ts`                                                                   | Payments are the ledger source of truth; bill totals/status are derived; invalid/non-positive payments rejected; deletions recalculate totals.                                   |
| `cross-owner-isolation.test.ts`                                                            | Service-role billing/reminder operations only read/write scoped owner data; no cross-owner bills/overdue updates; UPI intent uses owner VPA and reminders still work without it. |
| `razorpay-webhook.test.ts`                                                                 | Valid/invalid dedicated webhook HMACs, tampering, missing/truncated signatures, raw-body requirement and API-key/webhook-secret separation.                                      |
| `whatsapp-webhook.test.ts`                                                                 | Challenge verification, status/inbound parsing, valid delivery state filtering and best-effort batch update behavior.                                                            |
| `plan-period.test.ts`, `plan-proration.test.ts`, `price-display.test.ts`                   | Plan-period/grace calculations, monthly/annual upgrade proration, downgrade behavior and displayed pricing.                                                                      |
| `super-admin-mrr.test.ts`                                                                  | Monthly recurring revenue normalization for monthly and annual accounts; trials excluded.                                                                                        |
| `phone.test.ts`, `upi.test.ts`, `email-config.test.ts`, `site.test.ts`, `whatsapp.test.ts` | Input/environment/site/WhatsApp helper rules.                                                                                                                                    |

No test/build command was run while producing this static documentation; the test list describes covered behavior, not an assertion that the current checkout passes. The JSON document alongside this Markdown file records that distinction.

## 11. Recommended orientation for future developers

1. Start with `apps/web/src/routes/_authenticated/route.tsx`, `src/lib/use-directory.ts`, and the target route to understand the owner UI.
2. Identify whether an operation should be browser RLS CRUD, an authenticated server function, or a service-role backend operation. Do not import `client.server.ts` into browser-shipped modules.
3. For privileged owner work, trace ownership from owner to properties before acting on rooms/tenants/bills; never trust client-supplied cross-owner IDs.
4. Billing and payment behavior belongs around `billing-run.server.ts`, `billing.ts`, and `bill-notify.server.ts`; retain the payment-ledger invariant.
5. Payment activation changes belong in `plan-checkout.server.ts` and `plan-apply.server.ts`; preserve raw-body verification, secret separation and atomic claim semantics.
6. When changing plan limits, synchronize `pricing-plans.ts`, frontend `plan-limits.ts`, and the database triggers.
7. Modify migrations carefully and confirm deployed Supabase state before assuming an RLS/trigger change is live.

## 12. Important implementation references

- App boot: `apps/web/src/start.ts`, `apps/web/src/server.ts`, `apps/web/src/router.tsx`, `apps/web/vite.config.ts`
- Auth/privilege boundaries: `apps/web/src/integrations/supabase/{client.ts,auth-attacher.ts,auth-middleware.ts,client.server.ts}`
- Owner routes: `apps/web/src/routes/_authenticated/*.tsx`
- Public hooks: `apps/web/src/routes/api/public/hooks/*.ts`
- Billing: `apps/web/src/lib/{billing.ts,billing-run.server.ts,bill-notify.server.ts}`
- Reminders: `apps/web/src/lib/{reminders.server.ts,reminder-message.ts,email.server.ts,whatsapp.server.ts}`
- Plans/payments: `apps/web/src/lib/{plan-checkout.server.ts,plan-apply.server.ts,plan-lifecycle.server.ts,pricing-plans.ts}`
- Public link flow: `apps/web/src/lib/{tenant-signup.server.ts,complaint-submit.server.ts}`
- Schema/security: `apps/web/supabase/migrations/`
- Tests: `apps/web/tests/`
