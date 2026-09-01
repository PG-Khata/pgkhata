# PGKhata database

Last verified against source: 2026-08-03

Two schemas exist in this repository. The legacy Supabase schema holds all
production data. The new Drizzle schema has never been applied to a database.
This document describes both, maps between them, and records what will break at
cutover.

**Correction to `project.md`:** that document lists 17 legacy tables, which is
correct, but describes the stack as a single TanStack Start application. The
repository now also contains `packages/db/src/schema.ts` with eight new tables.
Both are live definitions; only the legacy one has data.

---

## Legacy schema — Verified

Built by 21 migration files under `apps/web/supabase/migrations/`, totaling
about 730 lines. Generated types at `apps/web/src/integrations/supabase/types.ts`.

One bootstrap migration (`20260801162455_c6c85475-b5bf-4bc6-b14e-dd6b258859b9.sql`)
creates 8 enums and 10 of the 17 tables. The remaining 7 accrete over the
following two days.

### Tables

**Operations (bootstrap migration)**

| Table | Key columns |
| --- | --- |
| `admins` | `id` (= `auth.uid()`), profile fields |
| `properties` | `id`, `admin_id`, name, address, city |
| `rooms` | `id`, `property_id`, `room_number`, `room_type`, `room_size`, `capacity`, `monthly_rent` |
| `tenants` | `id`, `room_id`, `full_name`, `phone`, `email`, `status`, `join_date`, `monthly_rent_override`, `security_deposit`, KYC and emergency-contact fields |
| `electricity_readings` | `id`, `room_id`, `reading_date`, `meter_reading`, `units_consumed_since_previous`, `calculated_amount` |
| `bills` | `id`, `tenant_id`, `property_id`, `bill_month`, `rent_amount`, `electricity_amount`, `other_charges`, `total_amount`, `paid_amount`, `status`, `approved`, `due_date`, `paid_at`, `payment_link_url`, `upi_qr_code_url` |
| `payments` | `id`, `bill_id`, `amount`, `method`, `transaction_ref`, `recorded_by`, `notes`, `paid_at` |
| `settings` | `admin_id` (PK), 24 columns: branding, currency, `electricity_rate_per_unit`, `due_date_offset_days`, plan state, reminder config |
| `notification_logs` | send history — the sole basis for reminder deduplication |
| `notification_templates` | per-admin message templates |

**Commercial (added 2026-08-02)**

| Table | Purpose |
| --- | --- |
| `plan_change_history` | proration credits, upgrade/downgrade record |
| `plan_payments` | Razorpay `provider_order_id`, `provider_payment_id`, `status` |

**Platform administration**

| Table | Purpose |
| --- | --- |
| `user_roles` | `app_role` enum: `super_admin`, `admin` |
| `super_admins` | platform accounts, `disabled` flag |
| `super_admin_audit_log` | append-only, trigger-enforced |
| `super_admin_login_attempts` | indexed on `lower(email)`, no retention policy |
| `owner_support_notes` | `admin_id` PK, service_role write, super-admin read |

### Ownership chain

```text
admins.id (= auth.uid())
  └─ properties.admin_id      ON DELETE CASCADE, DEFAULT auth.uid()
       └─ rooms.property_id   ON DELETE CASCADE
            └─ tenants.room_id ON DELETE RESTRICT

bills → tenant_id (CASCADE) + property_id (CASCADE)   -- denormalized, both FKs
payments → bill_id (CASCADE)                          -- no owner column of its own
```

`payments` has no admin or workspace column. RLS reaches the owner only by
joining `bills` → `properties`.

A note on cascade safety, since it is easy to get wrong: deleting a property
does **not** silently destroy its bills. `tenants.room_id` is `ON DELETE
RESTRICT`, so the property → rooms cascade aborts the whole transaction while
tenants still exist. The bills are protected by that restriction, not by their
own foreign key.

### Constraints — the important finding

**The legacy schema enforces almost nothing about money.**

Four UNIQUE constraints exist in total:

```sql
rooms                 UNIQUE (property_id, room_number)
tenants               phone TEXT NOT NULL UNIQUE        -- globally unique, see below
bills                 UNIQUE (tenant_id, bill_month)
notification_templates UNIQUE (admin_id, message_type, channel)
user_roles            UNIQUE (user_id, role)            -- added later
```

**Exactly one CHECK constraint exists across all 21 migrations:**

```sql
-- 20260802143058_*.sql
ADD CONSTRAINT settings_plan_check CHECK (plan IN ('starter','growing','scale'));
```

There is no CHECK on any monetary column anywhere. No `total_amount >= 0`, no
`paid_amount <= total_amount`, no `amount > 0` on payments, no
`capacity > 0` on rooms.

Instead, `bills.paid_amount` is maintained by client-side TypeScript
(`apps/web/src/lib/billing.ts`):

```ts
const paid = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
await supabase.from("bills").update({ paid_amount: paid, status, ... }).eq("id", billId);
```

A read-modify-write from the browser, with no transaction, no lock, and no
database constraint. Concurrent payment entry can leave `paid_amount` wrong or
exceeding `total_amount`.

`tenants.phone` being globally UNIQUE means two different PG owners cannot both
register a tenant with the same phone number — a real operational collision as
well as the cross-tenant oracle described in `security.md`.

One migration (`20260801202513_*.sql`) had to **delete duplicate bills** before
adding `bills_tenant_month_unique`, which indicates the original table-level
UNIQUE was not enforced in the deployed database and duplicates had already
accumulated in production.

### Triggers — 11 total

- Six `update_updated_at_column` triggers: properties, rooms, tenants, bills,
  notification_templates, settings.
- Three more on plan_payments, super_admins, owner_support_notes.
- `super_admin_audit_log_immutable` — `BEFORE UPDATE OR DELETE`, raises
  unconditionally.
- `on_auth_admin_created` — `AFTER INSERT ON auth.users`.

`payments` and `electricity_readings` have no `updated_at` column and therefore
no trigger.

### `handle_new_admin` — onboarding lives in DDL

The entire signup flow is a trigger on Supabase's `auth.users` table: it creates
the `admins` row, the `settings` row, the `user_roles` row, and routes platform
accounts into `super_admins`.

It was **rewritten four separate times** across migrations — single-admin
lockout, then user_roles, then a super-admin grant keyed on a hardcoded email,
then `super_admins` routing. One intermediate migration made signup hard-fail
once any admin existed:

```sql
IF EXISTS (SELECT 1 FROM public.admins) THEN
  RAISE EXCEPTION 'Registration is closed: an administrator account already exists.'
```

A later migration silently removed that guard, so registration reopened without
an explicit "reopen" migration.

Two problems follow. Signup semantics live in DDL rather than reviewable
application code, and **Better Auth has no `auth.users` table for this trigger
to attach to.** The whole onboarding path must be rewritten as application code
before cutover.

### SECURITY DEFINER functions

Surviving: `private.owns_property`, `private.owns_room`, `private.owns_tenant`,
`private.owns_bill`, `public.handle_new_admin`, `public.has_role`,
`public.is_super_admin`. `public.admin_exists` was created then dropped.

The four ownership helpers were originally in `public`, then relocated to a
`private` schema REVOKEd from `anon` and `authenticated`, with `search_path`
pinned — because `SECURITY DEFINER` functions in `public` are callable and
enumerable by clients. The public copies were dropped. This was a real
hardening step and is documented as a control in `security.md`.

`has_role` was granted to `authenticated` and then revoked in the very next
migration, leaving a function only `service_role` can call.

### Platform-bound constructs with no new counterpart

- The pg_cron monthly billing job (Supabase `pg_cron`/`pg_net`). The new stack
  polls `outbox_events` instead.
- `handle_new_admin` on `auth.users`.
- Storage RLS scoped by `auth.uid()` as the first path segment.

---

## New schema — Verified as written, never applied

`packages/db/src/schema.ts`, 170 lines, 8 tables, 5 enums.

### Enums

```ts
member_role     ["owner", "manager"]
tenant_status   ["active", "vacated", "notice-period"]
bill_status     ["pending", "paid", "partially-paid", "overdue"]
payment_method  ["UPI", "cash", "bank-transfer", "other"]
job_status      ["pending", "published", "failed"]
```

`tenant_status`, `bill_status`, and `payment_method` are value-identical to
their legacy counterparts, so those columns migrate 1:1.

### Tables

| Table | Notes |
| --- | --- |
| `workspaces` | `id`, `name`, `slug` (unique), `legacy_admin_id` (unique) |
| `workspace_memberships` | composite PK `(workspace_id, user_id)`, `role`, index on `user_id` |
| `properties` | `workspace_id`, name, address, city, `legacy_id` |
| `rooms` | `workspace_id`, `property_id`, `room_number`, `capacity`, `monthly_rent`, `legacy_id` |
| `tenants` | `workspace_id`, `room_id`, `full_name`, `phone`, `email`, `status`, `join_date`, `monthly_rent_override`, `legacy_id` |
| `bills` | `workspace_id`, `property_id`, `tenant_id`, `bill_month`, amounts, `other_charges`, `status`, `approved`, `due_date`, `legacy_id` |
| `payments` | `workspace_id`, `bill_id`, `amount`, `method`, `reference`, `idempotency_key`, `paid_at`, `legacy_id` |
| `outbox_events` | `workspace_id` (nullable), `topic`, `deduplication_key`, `payload`, `status`, `attempts`, `available_at`, `published_at`, `last_error` |

`workspace_memberships.userId` is plain `text` with **no foreign key** to any
auth table — deliberate, so Better Auth's user table can be replaced without
touching domain foreign keys. The comment in the schema says as much.

`outbox_events.workspaceId` is the only nullable workspace reference, allowing
platform-level events. Every domain table requires it NOT NULL.

### Constraints the new schema adds

```ts
uniqueIndex("rooms_workspace_property_number_uq")
uniqueIndex("tenants_workspace_phone_uq")          // workspace-scoped, not global
uniqueIndex("bills_workspace_tenant_month_uq")
uniqueIndex("payments_workspace_idempotency_uq")
uniqueIndex("outbox_topic_deduplication_uq")

check("rooms_capacity_positive",     capacity > 0)
check("rooms_rent_nonnegative",      monthly_rent >= 0)
check("tenants_rent_override_nonnegative", override IS NULL OR override >= 0)
check("bills_amounts_valid",         total >= 0 AND paid >= 0 AND paid <= total)
check("payments_amount_positive",    amount > 0)
```

Money precision widens from `NUMERIC(10,2)` to `NUMERIC(12,2)`. Safe, but any
reconciliation script must not assume identical types.

---

## Integrity gaps the new schema closes

Each row is a real defect in the legacy system, not a hypothetical.

| Invariant | Legacy | New |
| --- | --- | --- |
| `paid_amount <= total_amount` | not enforced; recomputed by unlocked browser TypeScript | `bills_amounts_valid` CHECK |
| Payment idempotency | none — a double-submit inserts two rows | `idempotency_key` NOT NULL + workspace-unique index |
| `amount > 0` on payments | guarded only in client JS (`if (!(input.amount > 0)) throw`), bypassed by any direct PostgREST call | `payments_amount_positive` CHECK |
| Room capacity sanity | `capacity INTEGER NOT NULL DEFAULT 1` accepts 0 or negative | `rooms_capacity_positive` CHECK |
| Tenant phone scoping | globally UNIQUE across all owners | scoped to workspace |
| Job deduplication | `notification_logs` is a write-after-the-fact log with no dedup or retry state | `outbox_topic_deduplication_uq` with transactional publish |

---

## Legacy → new mapping

### Direct

| Legacy | New | Join key |
| --- | --- | --- |
| `admins` | `workspaces` + `workspace_memberships` | `workspaces.legacy_admin_id` |
| `properties` | `properties` | `legacy_id` |
| `rooms` | `rooms` | `legacy_id` |
| `tenants` | `tenants` | `legacy_id` |
| `bills` | `bills` | `legacy_id` |
| `payments` | `payments` | `legacy_id` |

`legacy_admin_id` is UNIQUE, enforcing exactly one workspace per legacy admin
and making the backfill idempotent. `legacy_id` exists on exactly five tables,
each nullable and unique — nullable so natively-created rows need no legacy
origin, unique so a re-run cannot duplicate.

**These columns are referenced by zero code.** A grep across all `.ts`, `.tsx`,
`.sql`, `.md`, and `.json` outside `node_modules` finds them only in
`schema.ts`. There is no backfill script and no reconciliation script.

The property repository's `toContract` drops `legacyId` entirely, confirming
they are migration bookkeeping never exposed over the API.

### Columns dropped — data-loss risk

**`tenants` loses 10 columns:** `alternate_phone`, `address_proof_type`,
`address_proof_file_url`, `photo_url`, `permanent_address`,
`emergency_contact_name`, `emergency_contact_phone`, `security_deposit`,
`vacated_date`, `notes`.

`security_deposit` is a **monetary field with no destination**. Losing it at
cutover is a financial-data loss, not a cosmetic one. `vacated_date` is
operationally required — the tenant status enum has `vacated` but nothing
records when.

**`bills` loses:** `billing_cycle_start`, `billing_cycle_end`,
`electricity_units_consumed`, `payment_link_url`, `upi_qr_code_url`, `paid_at`,
`approved_at`. The bill PDF depends on the cycle dates and unit count; the
payment-link feature depends on the two URL columns.

**`payments` loses:** `recorded_by` and `notes`; `transaction_ref` is renamed
to `reference`. Losing `recorded_by` destroys the audit trail of who entered a
payment.

**`rooms` loses:** `room_type` and `room_size`. The
single/double/triple/dormitory classification disappears unless mapped into
`capacity` or a new column.

### Legacy tables with no new equivalent — 11

`electricity_readings`, `settings`, `notification_logs`,
`notification_templates`, `plan_change_history`, `plan_payments`, `user_roles`,
`super_admins`, `super_admin_audit_log`, `super_admin_login_attempts`,
`owner_support_notes`.

Three of these are blocking:

- **`settings`** carries 24 columns including `electricity_rate_per_unit` and
  `due_date_offset_days`, which drive bill generation. Without a new
  equivalent, **the billing engine has no configuration source after cutover.**
- **`plan_payments` / `plan_change_history`** hold Razorpay order and payment
  ids. Revenue reconciliation must stay on Supabase until these are ported.
- **`super_admin_audit_log`** is append-only by trigger and has no new
  counterpart. `outbox_events` is a job queue, not an audit log — do not
  conflate them.

`user_roles` maps only partially: legacy `app_role` is
`('super_admin','admin')`, new `member_role` is `('owner','manager')`. The
values do not line up, and **platform superadmin has no representation in the
new membership model at all.**

Four legacy enums have no counterpart: `room_type`, `notification_channel`,
`notification_status`, `message_type`, `address_proof_type`, `app_role`.

`electricity_readings` additionally has no unique constraint on
`(room_id, reading_date)`, so duplicate readings for one room on one day are
possible and `units_consumed_since_previous` can silently double-count. Fix
that before porting the table, not after.

---

## Cutover concerns

### Authentication — passwords cannot move

`apps/api/src/auth.ts` configures Better Auth with `emailAndPassword` and
`requireEmailVerification`, owning its own tables through the Drizzle adapter.
Supabase bcrypt hashes in `auth.users` cannot be safely imported as reusable
passwords.

**Every existing owner must set a new password at cutover.** Plan an expiring,
single-use activation link. Platform administrators must additionally re-enroll
MFA, since AAL2 enrollment is Supabase-side.

### Storage — every object key must be rewritten

Legacy Supabase Storage scopes by `auth.uid()` as the first path segment
(`20260801162545_*.sql`). The new S3 layer scopes by `workspaces/<id>/`.

Every stored object moves from `<admin_uuid>/...` to
`workspaces/<workspace_uuid>/...`, and `tenants.address_proof_file_url` and
`tenants.photo_url` still hold Supabase Storage paths, so those columns need
rewriting alongside the object copy. Verify by checksum, not by count.

The only client-side storage caller is
`apps/web/src/components/file-drop.tsx`, which uploads to the
`tenant-documents` bucket and mints one-hour signed URLs — one file to cut over.

### Data reconciliation — one ordering constraint that matters

`bills.paid_amount` is client-computed, so in production
`SUM(payments.amount)` per bill and `bills.paid_amount` **may already
disagree**. Deletion paths outside `syncBillTotals` leave `paid_amount` stale.

Therefore: reconcile `paid_amount` against the payments ledger **before**
applying the `bills_amounts_valid` CHECK. Applying the constraint first will
reject legitimate historical rows and stall the migration mid-flight.

Two more schema-default traps:

- Legacy `bills.due_date` is nullable and `rent_amount`/`total_amount` default
  to 0. New columns are NOT NULL with no default — **legacy rows with a NULL
  `due_date` will fail the backfill insert.** Decide the backfill value first.
- Legacy `bills.approved` defaults to `true`; new defaults to `false`. Any code
  path relying on insert defaults changes behavior at cutover.

### Rehearsal checklist

1. Record counts per table, legacy vs new.
2. Monetary totals: `SUM(bills.total_amount)`, `SUM(bills.paid_amount)`,
   `SUM(payments.amount)`.
3. Relationship integrity: every bill's tenant resolves through rooms to that
   bill's property (the invariant legacy RLS never enforced — see `security.md`
   S-4).
4. Object checksums for every migrated storage object.
5. Activation links issued, single-use, and expiring.

### Blocking prerequisites

Before any cutover can be attempted:

- Generate the Drizzle migrations — `packages/db/migrations` does not exist.
- Write the backfill script — `legacy_id` columns are currently decorative.
- Port `settings`, or the billing engine has no configuration.
- Decide the destination for `security_deposit` and the other dropped columns.
- Replace `handle_new_admin` with application-code onboarding.
- Build repositories beyond `properties` — one module cannot carry a cutover.
