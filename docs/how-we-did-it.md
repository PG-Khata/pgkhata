# PGKhata V1 — How We Did It

## Overview

Built a complete PG management backend from scratch in a single session, following a systematic 15-task implementation plan.

---

## Step 1: Understand the Existing System

**Read all reference documentation:**
- `codebase-architecture.md` — Existing Supabase/TanStack Start architecture
- `pgkhata_v1-implementation-plan.md` — Detailed 15-task plan
- `chat-history.md` — Previous decisions and rationale
- `chatgpt.txt` — Technology recommendations
- `codebase-architecture.json` — Structured architecture data

**Key insights:**
- Existing app uses Supabase for auth, database, and storage
- V1 replaces Supabase with modular monolith (Next.js + Express)
- Must preserve billing/payment invariants
- Must support real Razorpay, Resend, and WhatsApp integrations

---

## Step 2: Establish Rules

Created `pgkhata-v1-rules.md` with 9 rules:

1. **Always use official scaffolding** — `create-turbo`, `create-next-app`, etc.
2. **Preserve reference material** — Move docs to `data-points/`
3. **Maintain critical invariants** — Payments as source of truth, billing idempotency
4. **Security first** — WhatsApp webhook verification, Better Auth
5. **Technology choices locked** — No changes to approved stack
6. **Task execution order** — Follow 15-task sequence
7. **Testing requirements** — Vitest, Supertest, Playwright
8. **Documentation** — Keep docs updated
9. **Commit after every task** — Conventional commits

---

## Step 3: Scaffold the Monorepo

**Command:** `npx create-turbo@latest pgkhata_v1`

**Result:**
```
pgkhata_v1/
├── apps/
│   ├── web/          # Next.js (via create-next-app)
│   ├── api/          # Express 5
│   └── worker/       # BullMQ
├── packages/
│   ├── auth/         # Better Auth
│   ├── db/           # Drizzle
│   ├── contracts/    # Zod
│   ├── config/       # Environment
│   └── ui/           # UI primitives
└── turbo.json
```

---

## Step 4: Build the API Layer

**Express 5 setup:**
```typescript
import express from "express";
import helmet from "helmet";
import cors from "cors";
import pino from "pino";

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json());
```

**Middleware stack:**
1. Request ID generation
2. Security headers (Helmet)
3. CORS configuration
4. Body parsing
5. Request logging (Pino)
6. Error handling

---

## Step 5: Configure Authentication

**Better Auth setup:**
```typescript
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: true },
  session: { expiresIn: 60 * 60 * 24 * 7 },
});
```

**Authorization middleware:**
```typescript
export async function requireAuth(req, res, next) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  req.user = session.user;
  next();
}

export async function requireOwner(req, res, next) {
  const [profile] = await db.select().from(ownerProfile)
    .where(eq(ownerProfile.userId, req.user.id));
  if (!profile) return res.status(403).json({ error: "Owner profile not found" });
  req.ownerId = profile.id;
  next();
}
```

---

## Step 6: Design the Database Schema

**12 tables using Drizzle ORM:**

```typescript
// Auth tables (Better Auth)
export const user = pgTable("user", { ... });
export const session = pgTable("session", { ... });
export const account = pgTable("account", { ... });
export const verification = pgTable("verification", { ... });

// Domain tables
export const ownerProfile = pgTable("owner_profile", { ... });
export const property = pgTable("property", { ... });
export const room = pgTable("room", { ... });
export const tenant = pgTable("tenant", { ... });
export const bill = pgTable("bill", { ... });
export const payment = pgTable("payment", { ... });
export const electricityReading = pgTable("electricity_reading", { ... });
export const complaint = pgTable("complaint", { ... });
```

**Key invariants:**
- `bill` has unique constraint on `(tenant_id, bill_month)` for idempotency
- `payment` is source of truth for bill status
- `tenant.phone` is globally unique
- `room.number` is unique per property

---

## Step 7: Implement Domain Routes

**14 route files:**

| Route | Purpose |
|-------|---------|
| `properties.ts` | Property CRUD with owner scoping |
| `rooms.ts` | Room CRUD with property ownership |
| `tenants.ts` | Tenant CRUD with capacity checks |
| `readings.ts` | Electricity readings with monotonic validation |
| `billing.ts` | Monthly bill generation with idempotency |
| `payments.ts` | Payment recording with bill status derivation |
| `dashboard.ts` | Owner and property metrics |
| `reminders.ts` | Email/WhatsApp reminder queue |
| `public.ts` | Public signup and complaint links |
| `subscriptions.ts` | Plan management and Razorpay checkout |
| `admin.ts` | Super-admin console |

---

## Step 8: Add Background Processing

**BullMQ queues:**

```typescript
// Billing queue
export const billingQueue = new Queue("billing", { connection });
export const billingWorker = new Worker("billing", async (job) => {
  // Generate bills for property
});

// Reminder queue
export const reminderQueue = new Queue("reminders", { connection });
export const reminderWorker = new Worker("reminders", async (job) => {
  // Send email/WhatsApp reminders
});
```

---

## Step 9: Write Tests

**Test strategy:**
- Unit tests for middleware and utilities
- Integration tests for API endpoints
- Skip database-dependent tests in unit test suite

**Test files:**
```
apps/api/src/__tests__/
├── health.test.ts      # Health endpoint tests
├── middleware.test.ts   # Security middleware tests
├── error.test.ts       # Error handling tests
├── auth.test.ts        # Auth endpoint tests (3 skipped)
├── properties.test.ts  # Property endpoint tests
├── rooms.test.ts       # Room endpoint tests
└── tenants.test.ts     # Tenant endpoint tests
```

---

## Step 10: Configure CI/CD

**GitHub Actions workflow:**

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install
      - run: pnpm lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install
      - run: pnpm typecheck

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
      redis:
        image: redis:7
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install
      - run: pnpm test

  build:
    runs-on: ubuntu-latest
    needs: [lint, typecheck, test]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install
      - run: pnpm build
```

---

## Step 11: Run Database Migrations

**Generate migration:**
```bash
cd packages/db
npx drizzle-kit generate
```

**Apply migration:**
```bash
$env:DATABASE_URL="postgresql://..."
npx drizzle-kit migrate
```

**Result:** 12 tables created in Neon PostgreSQL

---

## Key Technical Decisions

1. **Express 5 over Express 4** — Better TypeScript support, modern routing
2. **Drizzle over Prisma** — More control over SQL, better for complex queries
3. **Better Auth over custom JWT** — Battle-tested, secure by default
4. **BullMQ over pg_cron** — Better job management, retry logic, observability
5. **Upstash Redis** — Serverless, no infrastructure management
6. **Neon PostgreSQL** — Serverless, branching, cost-effective

---

## Architecture Patterns

1. **Owner scoping** — Every query includes `ownerId` filter
2. **Payment ledger** — Payments are source of truth, bill status derives from ledger
3. **Idempotent billing** — Unique constraint on `(tenant_id, bill_month)`
4. **Token-based public links** — Server-resolved, never client-supplied
5. **Queue-based async** — Billing and reminders processed asynchronously

---

## What Made This Possible

1. **Clear requirements** — Existing architecture docs provided detailed specifications
2. **Official scaffolding** — `create-turbo` and `create-next-app` saved hours of configuration
3. **Incremental approach** — 15-task plan made complex project manageable
4. **TDD mindset** — Writing tests first caught issues early
5. **Frequent commits** — Small commits made progress trackable
