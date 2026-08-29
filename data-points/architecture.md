# PGKhata architecture

Last verified against source: 2026-08-03

Status vocabulary used throughout these documents:

- **Verified** — read in the current source.
- **Partial** — exists but incomplete or unsafe.
- **Planned** — a decision, not an implementation.
- **Not implemented** — no working path found.

This document describes what the repository actually is today, and what it is
being moved toward. It corrects `project.md`, which still describes a single
TanStack Start application; the repository is now a pnpm monorepo with a
partially built Express backend.

## Repository boundary

```text
D:\Projects\Pg_Manager\
|- data-points\       research and working notes; never committed
`- PG Manager Pro\    application repository; the only folder under Git
```

Git is initialized inside `PG Manager Pro` only. `.env` and `.env.*` are
ignored, `.env.example` is allowed.

## Current layout — Verified

```text
PG Manager Pro/
|- apps/
|  |- web/        legacy TanStack Start + Supabase. All working product behavior.
|  |- api/        Express 5 + Better Auth + Drizzle. One module. Five tests.
|  `- worker/     BullMQ + transactional outbox poller. Processor is a stub.
|- packages/
|  |- config/     Zod-validated environment, pino logger factory
|  |- contracts/  Zod schemas shared between API and web
|  |- db/         Drizzle schema and migration runner
|  `- storage/    S3-compatible private object storage
|- pnpm-workspace.yaml
`- tsconfig.base.json
```

Root `package.json` declares `packageManager: pnpm@10.15.1` and
`engines.node: >=22 <25`. The `check` script chains format, lint, typecheck,
test, and build.

### Workspace dependency graph

```text
@pgkhata/web      -> (standalone; still talks to Supabase directly)
@pgkhata/api      -> @pgkhata/config, @pgkhata/contracts, @pgkhata/db
@pgkhata/worker   -> @pgkhata/config, @pgkhata/db
@pgkhata/storage  -> (standalone; not yet imported by api or worker)
```

`packages/storage` is written but not wired into any application. `apps/web`
has no dependency on the new packages at all — the two halves of the monorepo
do not yet touch.

## Two request paths

The application currently has two entirely separate ways to reach data. Both
are live; only the first serves real users.

### Legacy path — Verified, carries all product behavior

```text
Browser (TanStack Router)
  |
  |-- Supabase browser client ---------> PostgreSQL under RLS
  |     Most owner CRUD is a direct
  |     supabase.from(...).insert() call
  |     issued from the route component.
  |
  `-- TanStack server function --------> *.server.ts (dynamic import)
        requireSupabaseAuth middleware        |
        verifies the bearer token via         |-- caller-scoped client (RLS applies)
        supabase.auth.getClaims()             `-- service-role client (RLS bypassed)
```

Two properties of this path matter:

1. **The browser is a database client.** Property and room creation have no
   server function at all — `apps/web/src/routes/_authenticated/properties.tsx`
   calls `supabase.from("properties").insert(draft)` directly. Tenancy is
   enforced entirely by row-level security policies in PostgreSQL.
2. **Server functions are thin shells.** The eight `*.functions.ts` modules in
   `apps/web/src/lib/` wrap authentication and then `await import()` a matching
   `*.server.ts`. The dynamic import is deliberate: it keeps service-role code
   out of the client bundle.

The service-role client lives behind a lazy Proxy in
`apps/web/src/integrations/supabase/client.server.ts` with an explicit warning
comment, for the same reason.

### Target path — Partial, one module exists

```text
Browser
  |
  `-- fetch /api/v1/... ---------------> Express 5 (apps/api)
                                            |- request id -> pino-http
                                            |- helmet, CORS allowlist, rate limit
                                            |- Better Auth session -> workspace identity
                                            |- module route -> repository
                                            `- Drizzle -> PostgreSQL (Neon)
```

`apps/api/src/app.ts` builds the application through a factory that takes its
dependencies as an argument, so tests instantiate it without opening a port.
`apps/api/src/server.ts` is the only file that touches the network.

Exactly one module exists: `apps/api/src/modules/properties/` with `list` and
`create`. There are no repositories for rooms, tenants, bills, or payments.

## The migration boundary

The approach is strangler-fig: `apps/web` keeps serving users while modules
move to `apps/api` one at a time.

**What has crossed:** `properties` (list and create only).

**What has not:** everything else — rooms, tenants, electricity readings,
bills, payments, reports, settings, notifications, plans, and the platform
console.

**The rule:** new behavior lands in `apps/api` first, test-first. Do not add
new server functions to `apps/web`; fix what is there and move it.

Two mechanical facts gate the migration:

- `packages/db/migrations` does not exist. `drizzle.config.ts` points its `out`
  at `./migrations` and `migrate.ts` reads `../migrations`, but no migration SQL
  has been generated. **The new schema has never been applied to a database.**
- The `legacy_id` columns on five tables and `legacy_admin_id` on `workspaces`
  are declared in the schema but referenced by zero code. No backfill script
  exists.

## Ownership model change

This is the most consequential architectural difference between the two halves.

| | Legacy | Target |
| --- | --- | --- |
| Ownership root | `admins.id` = `auth.uid()` | `workspaces.id` |
| Chain | admin → property → room → tenant | workspace → property → room → tenant |
| Enforcement | PostgreSQL RLS policies | application-code `where` clauses |
| Membership | implicit — one admin owns rows | `workspace_memberships` (composite PK) |

The legacy model has one owner per row, enforced by the database. The new model
introduces a workspace that can hold multiple members with an `owner`/`manager`
role — but **`packages/db/src/schema.ts` defines no RLS policies at all**.
Tenancy in the new backend is enforced only by the repository layer remembering
to filter. That is a deliberate trade to document, not an oversight to ignore:
it removes the database backstop the legacy system had.

The repository layer does currently hold the line correctly. Routes never read
a workspace id from the request body; they use `request.identity!.workspaceId`,
and `apps/api/src/modules/properties/repository.ts` hardcodes both the `where`
clause and the insert value.

One latent defect: `apps/api/src/auth.ts` resolves the workspace with
`.limit(1)` and no ordering, so a user in two workspaces gets a
non-deterministic binding. The schema already permits multi-membership.

## Runtime topology — Partial

Three processes, deployed independently from one repository:

```text
+-----------+        +------------------+        +-----------+
|  apps/web |        |     apps/api     |        | apps/worker|
|  (Vite)   |        |   Express :3001  |        |  BullMQ    |
+-----------+        +--------+---------+        +-----+-----+
                              |                        |
                              v                        v
                     +--------+------------------------+--+
                     |            PostgreSQL              |
                     |   domain tables + outbox_events    |
                     +------------------+-----------------+
                                        |
                                        v
                                    +---+---+
                                    | Redis |
                                    +-------+
```

The **transactional outbox** is the handoff. A write that must trigger async
work inserts an `outbox_events` row in the same transaction as the domain
change. The worker polls every second, claims rows with
`SELECT ... FOR UPDATE SKIP LOCKED`, and enqueues them into BullMQ.

This is the right pattern and the claim-loop is correctly written. The
implementation is incomplete in three specific ways — documented in
`error handling.md`, not repeated here.

The worker's job processor is currently a stub that logs and returns.
Topic-specific processors are added as each legacy module moves.

## Provider boundaries

External services sit behind interfaces so they can be swapped and faked in
tests.

| Provider | Purpose | Status |
| --- | --- | --- |
| Resend | transactional email | **Verified** — `apps/web/src/lib/email.server.ts` |
| Razorpay | owner subscription checkout | **Partial** — order + signature, no webhook |
| Meta WhatsApp Cloud API | tenant bill delivery | **Not implemented** |
| S3-compatible storage | tenant KYC documents | **Planned** — `packages/storage` written, unwired |
| Supabase Storage | tenant KYC documents | **Verified** — currently in use |

`packages/storage/src/index.ts` defines a `PrivateObjectStorage` interface with
`put`/`signedReadUrl`/`delete`. Keys are forcibly prefixed with
`workspaces/<workspaceId>/`, traversal via `..` is rejected, uploads set
`ServerSideEncryption: AES256`, and signed-URL TTL is hard-capped at 900
seconds regardless of what the caller requests.

## Rejected options

Recording these so they are not relitigated.

### Self-hosted WhatsApp bridge — rejected

Three independent reviews (DeepSeek, Qwen, Kimi transcripts) flagged the same
risk: an unofficial bridge such as `whatsapp-web.js` or Baileys works until
Meta's automated detection bans the sending number. For a product whose core
promise is billing over WhatsApp, and whose customers run their business on
their WhatsApp number, a ban is not a degraded feature — it is the customer's
business stopping.

**Decision: official Meta WhatsApp Cloud API only.** Template approval takes
one to two days and per-message cost is real but small. The cost of a ban is
not recoverable.

### Raw UPI QR without a gateway — rejected

A UPI QR code can be generated and sent, but UPI apps provide no webhook, so
nothing tells the system the tenant paid. "Send a QR" and "know it was paid"
are different problems, and only the second one removes the owner's manual
work. A payment gateway that emits webhooks is required for reconciliation.

Until that exists, payment recording stays honestly manual — which is what the
code does today.

### Microservices — rejected

The backend stays a modular monolith. Module boundaries are enforced by
directory structure and the repository pattern, not by network calls. Web,
API, and worker share one repository and deploy independently; that is the
whole of the distribution needed at this scale.

### Browser-side database access in the target — rejected

The end state has no Supabase client in the frontend. All data access goes
through `/api/v1`. This is what allows tenancy to be tested at one boundary
instead of trusted at every call site.

## Branding — Partial

Five names appear across the codebase:

| Name | Where |
| --- | --- |
| `pgkhata` | package names, storage bucket default, problem-type URLs |
| PG Manager Pro | repository folder only |
| PG Manager | in-app strings |
| Basera | marketing landing page and console |
| `basera.app` | hardcoded in three places, including cron migration SQL |

The founder's intended name is `pgkhata.com`. Reconciliation is a discrete
task, not a side effect of other work. Note that the `basera.app` URL in the
cron migration is also a functional defect, covered in `security.md`.
