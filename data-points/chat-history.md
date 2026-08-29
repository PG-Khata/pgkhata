# PGKhata V1 — Chat History

> This is a concise project-decision history, not a verbatim export of the entire agent transcript.

## Architecture review

The existing `PG Manager Pro` implementation was reviewed through:

- `codebase-architecture.json`
- `codebase-architecture.md`
- `chatgpt.txt`

Key conclusion: the existing product is a feature-rich, Supabase/TanStack Start application for multi-tenant PG and hostel operations. It supports properties, rooms, tenants/KYC, electricity readings, monthly billing, manual payment ledger reconciliation, reminders, tenant public links, complaints, Razorpay subscriptions, and a super-admin console.

## V1 technology decisions

The approved V1 direction replaces Supabase with a modular monolith and separate background worker:

```text
Turborepo + pnpm workspace
├── Next.js App Router web application
├── Express 5 REST API
├── BullMQ worker
├── Neon PostgreSQL + Drizzle ORM
├── Redis
├── Better Auth
├── Zod contracts
├── Pino logging
├── Helmet, CORS, and Redis-backed rate limits
├── Razorpay
├── Resend
└── Meta WhatsApp Cloud API
```

Authentication is owned by **Better Auth**. The project must not introduce a parallel custom JWT plus refresh-token implementation.

## Repository layout decision

The agreed future implementation layout is:

```text
pgkhata_v1/
├── apps/
│   ├── web/
│   ├── api/
│   └── worker/
├── packages/
│   ├── auth/
│   ├── db/
│   ├── contracts/
│   ├── config/
│   └── ui/
├── data-points/
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

Next.js must be initialized with its official CLI, specifically `pnpm dlx create-next-app@latest apps/web`; generated Next.js files should not be hand-created to imitate the CLI.

## Product and operational direction

- V1 targets full functional parity rather than a limited MVP.
- The product experience will be redesigned for pragmatic owner operations on desktop and mobile.
- Real Razorpay, Resend, and WhatsApp integrations are required, with staging/Test Mode validation.
- Deployment and operations work must cover containers, environments, secrets, health checks, logging, migrations, Neon branches/recovery, worker draining, CI/CD, rate limits, domains, and cost-conscious hosting.

## Key implementation invariants

- Payments are the financial source of truth; bill settlement status derives from the payment ledger.
- Monthly billing is transaction-safe and idempotent by `(tenant_id, bill_month)`.
- All tenant-owned data is scoped by the authenticated owner; cross-owner access must be tested.
- Scheduled billing produces reviewable drafts before notification.
- Public tenant/complaint links use active server-resolved tokens, never client-supplied owner/property identifiers.
- Razorpay, Resend, and Meta webhooks must validate raw-body signatures, deduplicate events, and be safe under retries/out-of-order delivery.
- KYC documents use private, signed S3-compatible object-storage access.

## Documentation outcome

The approved detailed implementation plan is stored in:

- [`pgkhata_v1-implementation-plan.md`](./pgkhata_v1-implementation-plan.md)

The existing documentation directory was moved from `PG Manager Pro/docs/` to this root-level `docs/` directory at the user’s request.
