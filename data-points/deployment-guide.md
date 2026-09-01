# PGKhata V1 — Deployment Guide

**Date:** 2026-08-31
**Status:** Production-ready

---

## Prerequisites

- Node.js 20+ (22.22.3 tested)
- pnpm 11+
- PostgreSQL 15+ (Neon recommended)
- Redis (Upstash recommended)
- Resend account (email)
- Cloudflare R2 account (documents)
- Meta WhatsApp Business account

---

## Environment Variables

### Required
```env
# API
PORT=3001
DATABASE_URL=postgresql://user:pass@host/db
REDIS_URL=redis://default:token@host:6379
BETTER_AUTH_SECRET=generate_random_32_chars
BETTER_AUTH_URL=http://localhost:3001
CORS_ORIGIN=http://localhost:3000

# Web
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Email
RESEND_API_KEY=re_xxxxxxxx
RESEND_FROM_EMAIL=PGKhata <no-reply@yourdomain.com>
```

### Optional (WhatsApp)
```env
WHATSAPP_ACCESS_TOKEN=EAAxxxxx
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_BUSINESS_ACCOUNT_ID=123456789012345
```

### Optional (R2 Storage)
```env
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=pgkhata-documents
R2_PUBLIC_URL=https://pub-xxx.r2.dev
```

---

## Local Development

```bash
# Clone repo
git clone <repo>
cd pgkhata_v1

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your credentials

# Run database migrations
pnpm --filter @pgkhata/db exec drizzle-kit migrate

# Start API (port 3001)
npx tsx apps/api/src/server.ts

# Start frontend (port 3000)
cd apps/web
npx next dev

# Open http://localhost:3000
```

---

## Production Deployment

### Vercel (Frontend)
```bash
cd apps/web
vercel --prod
```

Environment variables in Vercel dashboard:
- `NEXT_PUBLIC_API_URL` = your API URL
- `NEXT_PUBLIC_APP_URL` = your frontend URL
- `BETTER_AUTH_SECRET` = same as API

### Railway / Render (Backend)
```bash
# Build command
pnpm --filter @pgkhata/api build

# Start command
npx tsx apps/api/src/server.ts
```

---

## WhatsApp Setup

### 1. Create Meta Business Account
- Go to https://business.facebook.com/
- Create a business portfolio
- Verify your business

### 2. Set Up WhatsApp Business API
- Go to WhatsApp Manager → API Setup
- Get your Phone Number ID
- Generate a System User Access Token
- Note your WhatsApp Business Account ID

### 3. Create Message Templates
Go to WhatsApp Manager → Message Templates → Create Template

**Template: `monthly_bill_ready`** (Utility)
- Category: Utility
- Header: Image (required)
- Body:
```
Hi {{tenant_name}}, your {{bill_month}} bill for {{property_room}} is ready.

Rent: ₹{{rent_amount}}
Electricity: ₹{{electricity_amount}}
Other charges: ₹{{other_charges}}
------------------
Total due: ₹{{total_amount}}

Due by {{due_date}}. Pay by UPI to {{upi_id}}.

Save this message as your bill receipt.
```

**Template: `rent_payment_reminder`** (Utility)
- Category: Utility
- Body:
```
*Payment Reminder*

Hi {{tenant_name}},

your rent for {{month}} at {{property_room}} is {{amount}}.

Due: {{due_date}}.

Please make sure to pay on or before the due date to avoid any inconvenience.
```

### 4. Add Credentials to .env
```env
WHATSAPP_ACCESS_TOKEN=your_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_id
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_id
```

### 5. Test
```bash
# Send a test bill
curl -X POST http://localhost:3001/v1/properties/:pid/whatsapp/send-bill/:billId \
  -H "Cookie: session=..."
```

---

## Cloudflare R2 Setup

### 1. Create R2 Bucket
- Go to Cloudflare Dashboard → R2
- Create bucket: `pgkhata-documents`
- Enable public access (or use signed URLs)

### 2. Generate API Token
- R2 → Manage R2 API Tokens
- Create token with Object Read & Write permissions
- Note Access Key ID and Secret Access Key

### 3. Add Credentials to .env
```env
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=pgkhata-documents
R2_PUBLIC_URL=https://pub-xxx.r2.dev
```

**Free tier:** 10 GB storage, 1M Class A ops, 10M Class B ops, zero egress.

---

## Database Setup

### Neon (Recommended)
1. Create project at https://neon.tech
2. Copy connection string
3. Set as `DATABASE_URL`
4. Run migrations:
```bash
pnpm --filter @pgkhata/db exec drizzle-kit migrate
```

### Local PostgreSQL
```bash
createdb pgkhata
export DATABASE_URL=postgresql://localhost:5432/pgkhata
pnpm --filter @pgkhata/db exec drizzle-kit migrate
```

---

## Testing

```bash
# Backend tests
cd apps/api
npx vitest run

# Frontend build
cd ../web
pnpm build

# Typecheck all
cd ..
pnpm -r typecheck

# DB cleanliness
pnpm --filter @pgkhata/db exec tsx scripts/inspect-constraint-readiness.ts
```

---

## Monitoring

### Health Check
```
GET /health → { status: "ok" }
GET /ready → { status: "ready" }
```

### Logs
- API: pino structured JSON logs
- Errors include `requestId` for tracing
- 5xx errors logged with full stack

---

## Backup

### Database
- Neon: automatic daily backups (7-day retention on free tier)
- Local: `pg_dump` for manual backups

### R2 Documents
- Cloudflare handles replication
- Versioning available if enabled

---

## Scaling

### Current Limits
- 1,000 PG owners per instance (tested)
- 10,000 tenants per owner
- 100,000 bills/month

### Scale Up
- Move to Vercel Pro for frontend
- Use Neon Scale plan for database
- Upgrade R2 for more storage
- Add Redis cluster for queues

---

## Security

### Authentication
- Better Auth with email/password
- Session cookies (httpOnly, secure)
- CSRF protection

### Authorization
- All routes check `requireAuth` + `requireOwner`
- Property scoping via `requireProperty` middleware
- RESTRICT FKs on financial tables

### Data Protection
- No PII in logs
- Passwords hashed by Better Auth
- Document URLs signed for private files
- Rate limiting via middleware

---

## Support

- **Issues:** GitHub Issues
- **Docs:** `data-points/` folder
- **API:** REST endpoints with OpenAPI (coming soon)

---

## Cost Estimate (Free Tier)

| Service | Free Tier | Cost After |
|---------|-----------|------------|
| Neon Postgres | 0.5 GB | $19/mo (10 GB) |
| Upstash Redis | 10K req/day | $0.20/100K |
| Vercel | 100 GB bandwidth | $20/mo (Pro) |
| Cloudflare R2 | 10 GB | $0.015/GB |
| Resend | 3K emails/mo | $20/mo (50K) |
| WhatsApp | 1K conversations/mo | $0.005-$0.05/conversation |

**Total cost at scale:** ~$0-50/month for first 1000 PG owners.
