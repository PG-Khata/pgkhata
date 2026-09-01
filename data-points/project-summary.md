# PGKhata V1 — Project Summary

**Date:** 2026-08-31
**Status:** 30/30 features complete, production-ready
**Pricing:** 100% FREE for PG owners

---

## What is PGKhata?

PGKhata is a web-based PG (Paying Guest) management software that helps PG owners manage:
- Multi-property portfolios
- Tenants and beds
- Rent collection
- Expenses
- Staff
- Documents

**Unlike competitors** (PG Manager, RentOk, BTRoomer, etc.), PGKhata is **100% free forever**.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, TypeScript, TanStack Query, shadcn/ui |
| Backend | Express 5, Drizzle ORM |
| Database | PostgreSQL (Neon) |
| Cache/Queue | Redis (Upstash) |
| Auth | Better Auth |
| Email | Resend |
| Storage | Cloudflare R2 |
| Notifications | WhatsApp Business API |

---

## Business Model: FREE Forever (Jio Playbook)

**Core principle:** No premium tiers, no per-tenant fees, no hidden charges.

**Monetization (later):**
- Tenant marketplace (premium features for tenants)
- Financial services (working capital loans, insurance)
- Supplier network (food, cleaning, maintenance)
- Advertising (PG-related services)
- Data insights (anonymized market data)
- White-label for large PG chains

---

## Features (30/30)

### Property Management
- ✅ Multi-property portfolios
- ✅ Floor → Room → Bed hierarchy
- ✅ Bed-level tracking
- ✅ Vacancy dashboard
- ✅ Bed transfer
- ✅ Bed bookings
- ✅ Structure import/export
- ✅ Property amenities

### Tenant Management
- ✅ Tenant CRUD with approval workflow
- ✅ KYC documents (Aadhaar, PAN, etc.)
- ✅ Emergency contacts
- ✅ Financial reports
- ✅ Checkout preview
- ✅ Onboarding link
- ✅ QR signup

### Billing & Payments
- ✅ Auto bill generation
- ✅ Line-item billing
- ✅ Configurable charge types
- ✅ Rent plans
- ✅ Late fees (idempotent)
- ✅ Promised payment date
- ✅ Invoice voiding
- ✅ Advance payments
- ✅ Auto-allocate payments
- ✅ Security deposits
- ✅ Outstanding drill-down

### Expense Management
- ✅ Expense tracking
- ✅ Category management
- ✅ Approval workflow
- ✅ Expense summary

### Staff & Access Control
- ✅ Staff management
- ✅ Role-based permissions
- ✅ Module-level access

### Communication
- ✅ WhatsApp bill notifications
- ✅ WhatsApp payment reminders
- ✅ WhatsApp bulk reminders
- ✅ Notification preferences
- ✅ Email notifications (Resend)

### Reports & Analytics
- ✅ Dashboard analytics
- ✅ Monthly trend chart
- ✅ Due rent list
- ✅ Aging buckets
- ✅ CSV export
- ✅ Profit/Loss

### Data Management
- ✅ CSV import
- ✅ Admin documents
- ✅ Billing policy config
- ✅ Structure import/export

---

## Database Schema

**23 tables:**
1. `user` - Better Auth users
2. `session` - Active sessions
3. `account` - OAuth accounts
4. `owner_profile` - Owner metadata
5. `property` - PG properties
6. `floor` - Property floors
7. `room` - Rooms within floors
8. `bed` - Individual beds
9. `tenant` - Tenants
10. `rent_plan` - Rent plans
11. `charge_type` - Configurable charges
12. `electricity_reading` - Monthly readings
13. `bill` - Monthly bills
14. `payment` - Payment ledger
15. `advance_payment` - Advance payments
16. `security_deposit` - Deposits
17. `expense_category` - Expense categories
18. `expense` - Expenses
19. `complaint` - Complaints
20. `bed_booking` - Bed reservations
21. `staff` - Property staff
22. `property_amenity` - Amenities
23. `billing_policy` - Billing settings
24. `notification_preference` - Notification settings
25. `tenant_document` - KYC documents
26. `admin_document` - Property documents
27. `module_permission` - Staff permissions

**15 migrations** (0000-0015) applied.

---

## API Endpoints (60+)

### Core
- `GET /health`, `GET /ready`
- `GET /v1/me`

### Properties
- CRUD: `GET/POST/PUT/DELETE /v1/properties`
- `GET /v1/properties/:id/qr-code`

### Floors, Rooms, Beds
- Full CRUD with auto-creation

### Tenants
- CRUD with approval workflow
- `POST /:tenantId/approve`
- `POST /:tenantId/reject`
- `POST /:tenantId/onboarding-link`
- `POST /:tenantId/assign-bed`
- `POST /:tenantId/vacate-bed`
- `POST /:tenantId/transfer`
- `GET /:tenantId/checkout-preview`
- `GET /:tenantId/financial-report`

### Bills
- `GET /v1/properties/:pid/bills`
- `POST /generate`
- `POST /apply-late-fees`
- `POST /approve`
- `POST /:billId/void`
- `PATCH /:billId/promised-date`

### Payments
- `GET /v1/properties/:pid/payments`
- `POST /auto-allocate`

### Dashboard
- `GET /v1/dashboard/property/:pid/monthly-trend`
- `GET /v1/dashboard/property/:pid/due-rent`
- `GET /v1/dashboard/property/:pid/outstanding-payment`
- `GET /v1/dashboard/property/:pid/outstanding-payment/details`

### WhatsApp
- `GET /v1/properties/:pid/whatsapp/status`
- `GET /v1/properties/:pid/whatsapp/templates`
- `POST /v1/properties/:pid/whatsapp/setup-templates`
- `POST /v1/properties/:pid/whatsapp/send-bill/:billId`
- `POST /v1/properties/:pid/whatsapp/send-reminder/:tenantId`
- `POST /v1/properties/:pid/whatsapp/send-bulk-reminders`

---

## Test Results

- **Backend:** 35 test files, 324 passed, 3 skipped
- **Typecheck:** All packages pass
- **Build:** Frontend builds clean
- **DB:** All migrations applied

---

## Competitive Position

| Platform | Price | Niketan Parity | Our Edge |
|----------|-------|----------------|----------|
| **PGKhata** | **₹0** | **30/30** | FREE + modern + open source |
| PG Manager | ₹300/mo | ~80% | Has tenant app |
| My PG Manager | ₹159/mo | ~85% | Has AI assistant |
| BTRoomer | Custom | ~70% | Has PG marketplace |
| PG Master | Custom | ~75% | Has mobile app |
| RentOk | Custom | ~95% | Has lead management |

**PGKhata's advantages:**
1. **100% FREE** (competitors charge ₹159–₹300/month)
2. **Web-first** (works on any device)
3. **Open source** (no competitor offers this)
4. **Modern tech** (Next.js, TypeScript, TDD)
5. **Superior billing** (line-item, auto-allocate, voiding)

---

## File Structure

```
pgkhata_v1/
├── apps/
│   ├── api/          # Express 5 REST API
│   │   ├── src/
│   │   │   ├── routes/      # 23 route files
│   │   │   ├── lib/         # 18 pure libraries
│   │   │   ├── middleware/  # Auth, property scoping
│   │   │   └── server.ts
│   │   └── __tests__/  # 35 test files
│   └── web/          # Next.js App Router
│       └── src/
│           ├── app/         # 24 pages
│           ├── components/  # 20+ UI components
│           ├── hooks/       # 15+ data hooks
│           ├── lib/         # Utils, API client
│           └── types/       # TypeScript types
├── packages/
│   ├── auth/         # Better Auth
│   ├── db/           # Drizzle schema + migrations
│   ├── config/       # Env validation
│   ├── contracts/    # Zod schemas
│   └── email/        # Email templates
├── data-points/      # Documentation
│   ├── build-log-2026-08-31.md
│   ├── competitor-comparison.md
│   ├── deployment-guide.md
│   ├── missing-features.md
│   ├── project-summary.md (this file)
│   └── whatsapp-integration-context.md
└── docs/             # Project documentation
```

---

## How to Run

```bash
# Clone
git clone <repo>
cd pgkhata_v1

# Install
pnpm install

# Setup .env (see deployment-guide.md)
cp .env.example .env

# Database
pnpm --filter @pgkhata/db exec drizzle-kit migrate

# API (port 3001)
npx tsx apps/api/src/server.ts

# Frontend (port 3000)
cd apps/web && npx next dev
```

---

## Documentation

| File | Purpose |
|------|---------|
| `data-points/build-log-2026-08-31.md` | Detailed build log |
| `data-points/competitor-comparison.md` | vs 6 competitors |
| `data-points/deployment-guide.md` | Production deployment |
| `data-points/missing-features.md` | Feature status (30/30) |
| `data-points/whatsapp-integration-context.md` | WhatsApp setup |

---

## Key Achievements

- ✅ **30/30 Niketan features** complete
- ✅ **100% free** pricing
- ✅ **Webhook-style events** (tenant approval, late fees, etc.)
- ✅ **TDD throughout** (pure lib → test → route → integration test)
- ✅ **Conventional commits** (clear history)
- ✅ **RESTRICT FKs** on financial tables
- ✅ **Idempotent operations** (bill generation, late fees, etc.)
- ✅ **Multi-tenancy** via property scoping
- ✅ **Modern stack** (Next.js 16, TypeScript, TDD)

---

## Next Steps (Growth)

1. **Tenant Mobile App** (PWA) — 2-3 weeks
2. **Property Website** — Auto-generated landing pages
3. **Lead Management** — Inquiry to check-in pipeline
4. **AI Assistant** — Natural language PG queries
5. **Marketing Site** — SEO content, free tier landing page
6. **User Acquisition** — PG owner communities, WhatsApp groups

---

**Status:** Production-ready. All 30/30 features built, tested, and committed.
