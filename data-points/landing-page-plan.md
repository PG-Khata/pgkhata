# PGKhata Landing Page Plan

**Date:** 2026-08-31
**Status:** Ready to implement

---

## Architecture

```
pgkhata.com          → Landing page (marketing site)
app.pgkhata.com      → PG management app (current frontend)
api.pgkhata.com      → API server (current backend)
```

---

## Landing Page Features

### 1. Hero Section
- Headline: "Free PG Management Software"
- Subheadline: "Manage your PG properties, tenants, and billing - 100% free forever"
- CTA: "Get Started Free" → app.pgkhata.com/register
- Hero image/animation showing the app

### 2. Features Section
- Multi-property management
- Tenant management with approval workflow
- Auto bill generation
- WhatsApp notifications
- Expense tracking
- Reports & analytics
- Police verification
- Staff management

### 3. Pricing Section
- **FREE FOREVER** - No hidden charges
- Compare with competitors (₹159-₹300/month)
- Jio-style disruption messaging

### 4. Testimonials Section
- Placeholder for user testimonials
- Social proof

### 5. FAQ Section
- Common questions about PGKhata
- How it's free
- Data security
- WhatsApp integration

### 6. Footer
- Links to app, docs, contact
- Social media links
- Legal pages (Privacy, Terms)

---

## Technical Implementation

### Tech Stack
- Next.js 16 (static site)
- Tailwind CSS
- Shadcn/ui components
- Static export for fast loading

### Pages
1. `/` - Home page (hero, features, pricing, testimonials, FAQ)
2. `/pricing` - Detailed pricing page
3. `/features` - Features overview
4. `/about` - About PGKhata
5. `/contact` - Contact form
6. `/privacy` - Privacy policy
7. `/terms` - Terms of service

### Deployment
- Vercel (free tier)
- Custom domain: pgkhata.com
- SSL certificate (automatic with Vercel)

---

## Implementation Steps

### Step 1: Create Landing Page App
- Create `apps/landing/` directory
- Set up Next.js with Tailwind
- Configure for static export

### Step 2: Build Hero Section
- Headline and subheadline
- CTA buttons
- Hero image/animation

### Step 3: Build Features Section
- Feature cards with icons
- Feature descriptions
- Comparison with competitors

### Step 4: Build Pricing Section
- FREE FOREVER messaging
- Competitor comparison table
- Jio-style disruption messaging

### Step 5: Build Testimonials & FAQ
- Placeholder testimonials
- FAQ accordion

### Step 6: Build Footer & Legal Pages
- Footer with links
- Privacy policy
- Terms of service

### Step 7: Deploy to Vercel
- Connect to GitHub
- Configure custom domain
- SSL certificate

---

## Files to Create

```
apps/landing/
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── public/
│   ├── logo.png
│   ├── hero-image.png
│   └── favicon.ico
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── pricing/page.tsx
│   │   ├── features/page.tsx
│   │   ├── about/page.tsx
│   │   ├── contact/page.tsx
│   │   ├── privacy/page.tsx
│   │   └── terms/page.tsx
│   ├── components/
│   │   ├── Hero.tsx
│   │   ├── Features.tsx
│   │   ├── Pricing.tsx
│   │   ├── Testimonials.tsx
│   │   ├── FAQ.tsx
│   │   └── Footer.tsx
│   └── styles/
│       └── globals.css
└── README.md
```

---

## Deployment Configuration

### Vercel
- Framework: Next.js
- Root Directory: apps/landing
- Build Command: pnpm build
- Output Directory: .next

### Custom Domain
- Domain: pgkhata.com
- DNS: Point to Vercel
- SSL: Automatic

### Environment Variables
- NEXT_PUBLIC_APP_URL=https://app.pgkhata.com
- NEXT_PUBLIC_API_URL=https://api.pgkhata.com

---

## Marketing Messaging

### Headlines
- "Free PG Management Software"
- "Manage Your PG, Not Your Wallet"
- "The Jio of PG Management"

### Key Points
- 100% free forever
- No hidden charges
- WhatsApp integration
- Modern tech stack
- Open source

### Competitor Comparison
- PG Manager: ₹3,600/year
- My PG Manager: ₹159/month
- RentOk: Custom pricing
- PGKhata: ₹0 forever

---

## Success Metrics

- Landing page loads in <2 seconds
- Clear CTA to app.pgkhata.com
- Mobile responsive
- SEO optimized
- Social proof (testimonials)

---

## Next Steps

1. Create landing page app
2. Build hero section
3. Build features section
4. Build pricing section
5. Deploy to Vercel
6. Configure pgkhata.com domain
