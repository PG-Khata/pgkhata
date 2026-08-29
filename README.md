# PGKhata V1

> Multi-tenant PG (Paying Guest) management platform for Indian PG owners.

## What is PGKhata?

PGKhata is a SaaS platform that helps PG/hostel owners manage their properties, tenants, billing, and payments. It replaces manual spreadsheets and WhatsApp groups with a structured, automated system.

### Core Features

- **Property Management** — Multiple properties with rooms and capacity tracking
- **Tenant Management** — Tenant lifecycle with KYC, room assignment, and status tracking
- **Monthly Billing** — Automated rent + electricity bill generation with idempotency
- **Payment Ledger** — Payments are source of truth; bill status derives from ledger
- **Reminders** — Email and WhatsApp payment reminders with cooldown/deduplication
- **Public Links** — Tenant self-signup and complaint submission per property
- **Dashboard** — Real-time metrics for occupancy, collections, and overdue payments
- **Subscriptions** — Razorpay-powered plan management (Starter, Growing, Scale)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Web (apps/web)                    │
│                    App Router + Tailwind                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Express API (apps/api)                     │
│         Better Auth │ Zod │ Pino │ Helmet │ CORS            │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Neon PostgreSQL │ │  Upstash Redis  │ │  External APIs  │
│  (Drizzle ORM)  │ │  (BullMQ)       │ │  Razorpay       │
└─────────────────┘ └─────────────────┘ │  Resend         │
                              │          │  Meta WhatsApp  │
                              ▼          └─────────────────┘
                    ┌─────────────────┐
                    │  BullMQ Worker  │
                    │  (apps/worker)  │
                    └─────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Monorepo | Turborepo + pnpm |
| Frontend | Next.js 16 (App Router) |
| Backend | Express 5 |
| Database | Neon PostgreSQL |
| ORM | Drizzle ORM |
| Cache/Queue | Upstash Redis + BullMQ |
| Auth | Better Auth |
| Validation | Zod |
| Logging | Pino |
| Payments | Razorpay |
| Email | Resend |
| WhatsApp | Meta Cloud API |
| Testing | Vitest + Supertest |
| CI/CD | GitHub Actions |

---

## Project Structure

```
pgkhata_v1/
├── apps/
│   ├── web/                    # Next.js frontend
│   ├── api/                    # Express REST API
│   │   ├── src/
│   │   │   ├── middleware/     # Auth middleware
│   │   │   ├── routes/         # 14 route files
│   │   │   └── __tests__/      # 7 test files
│   │   └── package.json
│   └── worker/                 # BullMQ worker
│       └── src/
│           └── queues/         # Billing + reminder queues
├── packages/
│   ├── auth/                   # Better Auth config
│   ├── db/                     # Drizzle schema + migrations
│   ├── contracts/              # Zod schemas
│   ├── config/                 # Environment validation
│   └── ui/                     # Reusable UI primitives
├── data-points/                # Reference documentation
├── docs/                       # Development documentation
├── docker-compose.yml          # Local development
└── .github/workflows/ci.yml    # CI/CD pipeline
```

---

## Database Schema

### Auth Tables (Better Auth)
- `user` — User accounts
- `session` — Active sessions
- `account` — OAuth accounts
- `verification` — Email verification

### Domain Tables
- `owner_profile` — Owner profiles
- `property` — Properties with signup/complaint tokens
- `room` — Rooms with capacity
- `tenant` — Tenants with status tracking
- `bill` — Monthly bills (idempotent by tenant+month)
- `payment` — Payment ledger (source of truth)
- `electricity_reading` — Meter readings
- `complaint` — Public complaints

### Key Invariants
1. **Payments are source of truth** — Bill status derives from payment ledger
2. **Billing idempotency** — Unique constraint on `(tenant_id, bill_month)`
3. **Owner scoping** — Every query includes `ownerId` filter
4. **Scheduled billing = drafts** — Owner approval required before notification

---

## API Endpoints

### Properties
```
GET    /v1/properties              # List all properties
POST   /v1/properties              # Create property
GET    /v1/properties/:id          # Get property
PUT    /v1/properties/:id          # Update property
DELETE /v1/properties/:id          # Delete property
```

### Rooms
```
GET    /v1/properties/:pid/rooms           # List rooms
POST   /v1/properties/:pid/rooms           # Create room
GET    /v1/properties/:pid/rooms/:rid      # Get room
PUT    /v1/properties/:pid/rooms/:rid      # Update room
DELETE /v1/properties/:pid/rooms/:rid      # Delete room
```

### Tenants
```
GET    /v1/properties/:pid/tenants         # List tenants
POST   /v1/properties/:pid/tenants         # Create tenant
GET    /v1/properties/:pid/tenants/:tid    # Get tenant
PUT    /v1/properties/:pid/tenants/:tid    # Update tenant
DELETE /v1/properties/:pid/tenants/:tid    # Delete tenant
```

### Billing
```
GET    /v1/properties/:pid/bills           # List bills
POST   /v1/properties/:pid/bills/generate  # Generate monthly bills
POST   /v1/properties/:pid/bills/approve   # Approve bills
```

### Payments
```
GET    /v1/properties/:pid/payments        # List payments
POST   /v1/properties/:pid/payments        # Record payment
DELETE /v1/properties/:pid/payments/:payid # Delete payment
```

### Dashboard
```
GET    /v1/dashboard/owner                 # Owner portfolio
GET    /v1/dashboard/property/:pid         # Property dashboard
```

### Public (No Auth)
```
GET    /public/signup/:token               # Get signup form
POST   /public/signup/:token               # Submit signup
GET    /public/complaint/:token            # Get complaint form
POST   /public/complaint/:token            # Submit complaint
```

---

## Getting Started

### Prerequisites
- Node.js 22+
- pnpm 10.15.1+
- Neon PostgreSQL account
- Upstash Redis account

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd pgkhata_v1

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your credentials

# Run database migrations
cd packages/db
npx drizzle-kit migrate

# Start development servers
cd ../..
pnpm dev
```

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://...

# Redis
REDIS_URL=redis://...

# Auth
BETTER_AUTH_SECRET=your-secret-key-at-least-32-chars
BETTER_AUTH_URL=http://localhost:3001
CORS_ORIGIN=http://localhost:3000

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000
```

---

## Development

### Commands

```bash
# Development
pnpm dev                    # Start all apps
pnpm dev --filter @pgkhata/api    # Start API only
pnpm dev --filter @pgkhata/web    # Start web only

# Testing
pnpm test                   # Run all tests
pnpm test --filter @pgkhata/api  # Run API tests

# Building
pnpm build                  # Build all apps

# Linting
pnpm lint                   # Lint all packages
pnpm typecheck              # Type check all packages
```

### Testing

```bash
# Run API tests
cd apps/api
npx vitest run

# Run with watch mode
npx vitest
```

---

## Deployment

### Docker

```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build individual services
docker build -f apps/api/Dockerfile -t pgkhata-api .
docker build -f apps/worker/Dockerfile -t pgkhata-worker .
```

### CI/CD

GitHub Actions workflow runs on push to `main`:
1. Lint
2. Type check
3. Test (with PostgreSQL and Redis services)
4. Build

---

## Documentation

| File | Description |
|------|-------------|
| [README.md](./README.md) | This file — project overview |
| [docs/work-log.md](./docs/work-log.md) | Detailed task-by-task log |
| [docs/chat-history.md](./docs/chat-history.md) | Session conversation history |
| [docs/war-story.md](./docs/war-story.md) | Challenges and solutions |
| [docs/how-we-did-it.md](./docs/how-we-did-it.md) | Technical approach |
| [docs/development-summary.md](./docs/development-summary.md) | Complete project overview |
| [data-points/](./data-points/) | Reference documentation |

---

## Key Decisions

1. **Express 5 over Express 4** — Better TypeScript support, modern routing
2. **Drizzle over Prisma** — More control over SQL, better for complex queries
3. **Better Auth over custom JWT** — Battle-tested, secure by default
4. **BullMQ over pg_cron** — Better job management, retry logic, observability
5. **Upstash Redis** — Serverless, no infrastructure management
6. **Neon PostgreSQL** — Serverless, branching, cost-effective

---

## Competitive Analysis

See [data-points/niketan-analysis.md](./data-points/niketan-analysis.md) for comparison with Niketan PG management platform.

---

## License

Proprietary — All rights reserved.

---

## Contact

For questions or support, contact the development team.
