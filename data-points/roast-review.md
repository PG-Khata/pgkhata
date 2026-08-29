# Roast review — what the three critiques got right, wrong, and missed

Last updated: 2026-08-03

Three AI reviewers roasted the PGKhata plan: `deepseek-chat.txt`,
`qwen-chat.txt`, `kimi-chat.txt`. All three worked from a written description of
the product, not from the repository. That distinction decides which criticisms
matter.

This document sorts every critique into: **confirmed against source**,
**factually wrong**, **not checkable in code**, and **missed entirely**. It also
carries corrected 2026 cost figures, because three separate documents in
`data-points` currently repeat numbers that are now stale.

Raw transcripts stay unchanged. This is the reconciliation, not a replacement.

---

## 1. The convergence

Where three independent reviewers land on the same point without seeing each
other's answers, that agreement is the signal — more than any single argument.

They converged on three things:

1. The self-hosted WhatsApp bridge will get the number banned.
2. The introvert-founder go-to-market contradicts itself.
3. Pricing assumes a willingness to pay that has never been tested.

Only the first is checkable in code, and checking it changes the conclusion.

---

## 2. Confirmed against source

### 2.1 Electricity billing does not survive real PGs — Qwen

Qwen's claim: half of PGs have no sub-meter, some are broken, and many owners
charge a flat rate regardless of use.

**Confirmed, and the code is more fragile than the critique assumed.**

`apps/web/src/lib/billing-run.server.ts` splits a room's units evenly across
active tenants:

```ts
const units = round2(roomUnits / (tenantsPerRoom.get(room.id) || 1));
const electricity = round2(units * rate);
```

No proration for move-in or move-out dates. A tenant who joined on the 28th pays
the same share as one who stayed all month.

Worse, the rate falls back silently:

```ts
const rate = Number(config?.electricity_rate_per_unit ?? 0);
```

A missing `settings` row produces a ₹0 electricity charge on every bill, with no
error. The bill still sends. Nobody finds out until an owner notices the total
is wrong.

Also unconstrained: `electricity_readings` has no unique index on
`(room_id, reading_date)`, so a duplicate reading double-counts consumption.

**Action:** this is a product-model question before it is a code question. Ask
three real owners how they actually charge for power. Recorded as a Phase 2 gate
in `phases.md`.

### 2.2 The stack is heavier than the product — Qwen

Qwen aimed at Redis and BullMQ. He was directionally right and aimed at the
smaller half.

**Redis/BullMQ — partially confirmed.** `apps/worker` is 79 lines and its
processor only logs:

```ts
// Topic-specific processors are added using TDD as each legacy module moves.
logger.info({ jobId: job.id, eventId: job.data.eventId }, "Outbox event received");
```

Real infrastructure protecting zero work. But this is *sequencing*, not
over-engineering — the transactional outbox is the correct pattern for billing,
it just landed before anything needed it. And the cost objection is empty:
Upstash's free tier covers 500K commands/month, far beyond this workload.

**Qwen's proposed fix is wrong.** He wrote: *"A simple cron job will do for 100
customers."* You have a simple cron job. **It has never fired** — it sends an
`apikey` header the endpoint rejects (`security.md` S-3). Simpler is not more
reliable. Verified is more reliable.

**The larger waste is the frontend**, which no reviewer mentioned. Measured:

| Measure | Count |
| --- | --- |
| UI components in `components/ui/` | 43 |
| Never imported outside `components/ui/` | **29** |
| Dead lines in those components | **2,724 of 4,361** |
| Radix packages declared | 26 |
| Radix packages actually reachable | **8** |

Eight heavy dependencies each feed exactly one dead component:

| Package | Imported only by |
| --- | --- |
| `recharts` | `ui/chart.tsx` |
| `react-hook-form` | `ui/form.tsx` |
| `embla-carousel-react` | `ui/carousel.tsx` |
| `react-day-picker` | `ui/calendar.tsx` |
| `cmdk` | `ui/command.tsx` |
| `vaul` | `ui/drawer.tsx` |
| `input-otp` | `ui/input-otp.tsx` |
| `react-resizable-panels` | `ui/resizable.tsx` |

And three have **zero imports anywhere** in `apps/web`: `zod`, `date-fns`,
`@hookform/resolvers`.

This is Lovable's scaffold, not hand-written code — shadcn installs the full set
regardless of use. It is still yours to delete now.

**Action:** deleting the 29 components and ~12 packages is mechanical and
low-risk. Do it *before* migrating modules, so dead weight is not ported. Full
list in section 6.

### 2.3 Migrating mid-build is the trap — Kimi

Kimi's claim: 80% of effort goes into migration instead of market validation,
and AI-written backend code without strong backend understanding ships race
conditions and data inconsistency.

**This is the most accurate critique of the three.** The proportion:

```
apps/web/src     19,331 lines   all product behavior, 0 tests, 2 live cross-tenant defects
apps/api/src        276 lines   1 module (properties), 5 tests
apps/worker/src      79 lines   stub processor
packages            334 lines
```

98% of the code is in the half being migrated away from. And his prediction
about race conditions was correct in specifics he could not have seen:

- Payment recording is a browser-issued insert-then-aggregate with no
  transaction and no idempotency key (`error handling.md` L-1).
- Reminder deduplication is check-then-act with no database constraint —
  concurrent runs both send (L-3).
- Plan confirmation marks paid before applying the plan, so a retry reports
  success while the owner stays on the old tier (L-2).

He inferred these from "AI-generated backend" as a category. They are all real.

### 2.4 Tenant-side network effect is zero — Kimi

Confirmed structurally. There is no tenant-facing route, portal, or account
anywhere in the repository. Retention depends entirely on the owner.

This was a deliberate product decision in `intention.txt` — tenant friction is
the top reason such products fail — and it remains defensible. But Kimi is right
that it caps growth to owner-by-owner word of mouth. Worth holding consciously
rather than by default.

---

## 3. Factually wrong

Verified against current published sources, August 2026. Three documents in
`data-points` repeat some of these figures; treat this table as the correction.

| Claim | Source | Status |
| --- | --- | --- |
| "₹0.50 per WhatsApp conversation" | Qwen | **WRONG.** Per-conversation billing for templates ended 1 July 2025. Billing is per-message. |
| "₹0.115 per utility message" | DeepSeek | **CORRECT** on the Jan 2026 rate card. |
| "Meta API lele — ₹10–15k/month ka kharcha" | DeepSeek | **WRONG by ~40x.** At 150–3,000 msgs/month: **₹17–₹345/month**. |
| "BSP platform fee ₹999–₹2,000/month" | Both | **LOW.** Floor ~₹1,500 (AiSensy Basic), typical ~₹2,500 (Wati Growth ₹2,499), Gupshup ₹4,000+. |
| "Render free Postgres expires after 90 days" | Claude | **WRONG — 30 days**, changed 2024-05-20, plus 14-day grace then deletion. |
| "UPI reconciliation is fantasy / impossible" | Kimi | **WRONG with a gateway.** Razorpay QR Codes supports reusable static QRs with real-time webhooks. Correct only for a plain bank-issued static QR. |
| "UPI MDR near-zero" | Claude | **CORRECT.** Zero MDR for P2M still holds. A tiered MDR was *proposed* by a Parliamentary committee on 2026-03-12; no RBI/CBDT notification issued. |

**The most costly error was DeepSeek's.** By framing the official Meta API as a
₹10–15k/month expense, it made the safe choice look unaffordable and the
dangerous one look pragmatic. The real cost of doing it correctly is under ₹350
per month. The ban risk was never worth taking.

### Facts worth knowing before building the WhatsApp path

- **Free window:** utility templates sent inside an open 24-hour customer
  service window are free. Service conversations have been free since
  2024-11-01. Billing volume is lower than a naive per-bill count suggests.
- **Unverified numbers are capped at 250 business-initiated conversations per
  24 hours** and cannot tier up. Start business verification early — it takes
  days to weeks with no fixed SLA. Template approval is near-instant once
  verified, up to 24h if not.
- **Razorpay has two different QR products.** "QR Codes" supports reusable
  static QRs with webhooks. "Smart Collect" / UPI QR virtual accounts cannot —
  dynamic one-time only. Choosing wrong means rebuilding.
- **Cashfree webhook signatures are HMAC-SHA256 over the raw body.** Parsing the
  JSON first corrupts decimal amounts and breaks verification.
- **Direct Cloud API beats a BSP at this volume by 5–100x.** The platform fee
  dominates; message cost is rounding error.

### Hosting, current state

| Service | Reality 2026 |
| --- | --- |
| Render free Postgres | 30 days, 1 GB, no backups, then deleted |
| Render free web service | 750 instance-hours/workspace/month; spins down after 15 min idle, ~1 min cold start |
| Neon free | 100 CU-hours/project/month, 0.5 GB storage/project; scale-to-zero after 5 min, cannot be disabled |
| Supabase free | **Pauses after ~7 days of low activity**, manual unpause; Pro at $25/mo/project is the only real fix |
| Upstash Redis free | 256 MB, 500K commands/month (the old 10K/day cap ended 2025-03-12) |

The Supabase pause behavior matters for a product whose defining event is a
monthly billing run. A project that pauses between runs is a product that
appears broken at exactly the moment it should work.

---

## 4. Not checkable in code

Real questions, unanswerable from the repository. They need actual PG owners,
and they belong in the Phase 2 gates in `phases.md`.

**The tax question — DeepSeek's sharpest point.** Many small PG owners deal in
cash and mixed accounting. An automated UPI trail creates a record they may not
want. If the owner would rather have a PDF he forwards himself so he can take
cash, then the reconciliation roadmap is aimed at a problem he does not have.

Ask before building further automation on the assumption.

**The vacancy question.** One empty bed costs ₹15,000/month; the subscription is
₹500. Billing is a vitamin next to that painkiller. This does not mean build
vacancy management — `intention.txt` deliberately excludes it. It means know
honestly whether you are selling a nice-to-have, and price and pitch
accordingly.

**The GTM contradiction.** All three flagged it: door-to-door demos demand more
social energy than cold calling, not less. Qwen's alternative was the concrete
one — do not knock on doors. Stand outside a PG or near a kirana store owners
frequent, and show the WhatsApp message on your phone. *"Bhaiya, aapka bill aisa
dikhega, 2 minute mein ban jayega."* Visual proof over verbal demo.

**Pricing and churn.** Kimi's arithmetic: ₹1,000 average × 100 customers =
₹1 lakh/month before hosting, gateway fees, and support time. DeepSeek added
that PG turnover is high, so churn is structural.

One checkable detail neither could see: **plan pricing is triplicated in the
codebase** — marketing strings in `pricing-plans.ts`, canonical `planTiers`
amounts used for proration and gating, and a third hardcoded `planPrice` map in
`super-admin.server.ts` driving the MRR metric. Three sources of truth for a
number that has never been validated with a paying customer.

**Support cost.** DeepSeek's point that a non-technical owner will call at 10pm
when a payment does not reflect. Unfalsifiable from code — but note that the
reminder run can send *duplicate* emails when a supporting query fails
(`error handling.md` L-4). That is a support-call generator sitting in the code
today.

---

## 5. What all three missed

They critiqued the plan. Nobody read the code. The defects that actually
threaten the business first:

1. **Any authenticated owner can trigger reminder emails to every other owner's
   tenants** and flip their bills to `overdue`. Cross-tenant, with irreversible
   external side effects (`security.md` S-2).
2. **Scheduled billing has never once fired.** The cron sends an `apikey` header;
   the route requires `x-cron-secret`. A monthly-billing product whose monthly
   billing does not run (S-3).
3. **A live Supabase key is committed in migration SQL** (S-3).
4. **Zero tests in `apps/web`** — the 19,331 lines serving every user.
5. **`packages/db/migrations` does not exist.** The new schema has never been
   applied to any database, and the `legacy_id` columns meant to join old to new
   are referenced by zero code.

A ban risk not yet taken ranks below a cross-tenant defect running in
production today.

---

## 6. Deletable inventory

Mechanical, low-risk, and best done before module migration so dead weight is
not ported.

**29 unused UI components** in `apps/web/src/components/ui/`:

```
accordion, alert, aspect-ratio, avatar, breadcrumb, calendar, carousel, chart,
checkbox, collapsible, command, context-menu, drawer, dropdown-menu, form,
hover-card, input-otp, menubar, navigation-menu, pagination, popover,
radio-group, resizable, scroll-area, slider, tabs, toggle, toggle-group, tooltip
```

**18 unreachable Radix packages:**

```
accordion, aspect-ratio, avatar, checkbox, collapsible, context-menu,
dropdown-menu, hover-card, menubar, navigation-menu, popover, radio-group,
scroll-area, slider, tabs, toggle, toggle-group, tooltip
```

**11 other packages** with no live import path: `recharts`,
`embla-carousel-react`, `react-day-picker`, `cmdk`, `vaul`, `input-otp`,
`react-resizable-panels`, `react-hook-form`, `zod`, `date-fns`,
`@hookform/resolvers`.

**Method used, so this can be re-run after any change:**

```bash
# a UI component is dead if nothing outside components/ui imports it
for f in components/ui/*.tsx; do
  n=$(basename "$f" .tsx)
  c=$(grep -rl "ui/$n\"" --include=*.tsx --include=*.ts . | grep -v "components/ui/" | wc -l)
  [ "$c" -eq 0 ] && echo "UNUSED: $n"
done
```

Verify against the build before deleting — `routeTree.gen.ts` is generated, and
a component referenced only from generated code would not show in the grep.

---

## 7. What to carry forward

**Decided.** Official Meta WhatsApp Cloud API only; the bridge is rejected in
`architecture.md`. A payment gateway with webhooks, not a raw UPI QR. Both cost
far less than DeepSeek estimated.

**To ask real owners, before Phase 2 completes.** How do you actually charge for
electricity? Do you want an automated payment trail, or a PDF you forward
yourself? Would you pay ₹499/month with no discount and no free trial?

**To do now, independent of any answer.** Fix the two cross-tenant defects. Fix
the cron. Rotate the committed key. Delete the dead dependencies. None of these
depend on a business question being resolved first.

**How to use this kind of review again.** The convergence was the signal, not
any single argument, and the reviewers were most useful where they were most
uncomfortable. But every specific number they offered needed checking — three of
the seven cost claims were wrong, one by a factor of forty. Prompt 9 in
`prompts.md` is written for this; its acceptance check exists because of this
document.
