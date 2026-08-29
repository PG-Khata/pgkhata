# TODO

## [HIGH PRIORITY] WhatsApp bill PDF + UPI pay link

**What:** When a tenant taps "Visit website" on the WhatsApp bill-ready
template, open a public link that shows/downloads their full bill (name,
room, rent, electricity, other charges, total) and lets them pay the owner
directly by UPI (QR and/or tap-to-pay) from that page.

**Why:** Requested as a follow-up to the `monthly_bill_ready` WhatsApp
template (see `apps/web/whatsapp-bill-template-plan.md`). Deferred out of
that template so the MVP launch and template review aren't blocked on it —
this is a real feature, not a template tweak.

**Already exists, reusable:**
- `apps/web/src/lib/bill-pdf.ts` — full bill PDF generation (tenant, room,
  property, rent, electricity, charges, total) via jsPDF. Hardest part is
  already built.
- `apps/web/src/lib/upi.ts` — `buildUpiIntent()` builds a `upi://pay` deep
  link with the amount pre-filled from the owner's `settings.upi_vpa`.
- `bills.payment_link_url` column exists in the schema already, currently
  unused everywhere — looks designed for exactly this.

**New work needed:**
1. Public route (unauthenticated — tenants aren't logged-in app users),
   similar in shape to the existing `/api/public/hooks/*` routes.
2. Secure link scheme — can't be a guessable bill ID, since it exposes
   another person's rent/payment status. Needs a signed or random token,
   ideally with an expiry.
3. Wire link generation into bill creation (`billing-run.server.ts` /
   `tenant-billing.server.ts`) to populate `payment_link_url`.
4. An actual HTML payment page (not just a raw PDF) — `upi://` deep links
   need a normal tap target, which a PDF viewer inside WhatsApp's in-app
   browser can't reliably provide. Page should show the bill and a "Pay by
   UPI" button/link, plus a PDF download alongside it.
5. QR code rendering, if a visual QR is wanted in addition to tap-to-pay —
   no QR library is in the codebase yet, so this is a new dependency.
6. Meta's WhatsApp template URL button supports one trailing dynamic
   variable (`https://app.pgkhata.com/bill/{{1}}`), so the template
   mechanism is already compatible — this just needs the destination page
   to exist.

**Also outstanding (related, smaller):**
- The "I've paid" Quick Reply button on `monthly_bill_ready` currently goes
  nowhere useful — the webhook (`whatsapp-webhook.server.ts`) only
  `console.info`s inbound messages. Needs to notify the specific owner
  (email, or a dashboard flag) once a tenant taps it or replies. Same
  root cause as above: one shared platform WhatsApp number, so replies
  land centrally and need explicit routing back to the right owner.

## Follow-ups from the 2026-08-13 signup/complaint links session

See `AI-work-log.md` for the full account. These are the concrete loose ends,
not covered by the phases in `phases.md` because that document predates the
feature entirely.

1. **Test data left in the live database.** A real tenant
   (`Test Tenant Playwright`, phone `+919123456780`, The NCR Homes PG · Room
   101) and a real complaint (`Rahul Complainer`, Room 407) were created while
   verifying the feature end to end, then not cleaned up. Delete both, or
   confirm the founder wants to keep them as a smoke-test fixture.

2. **File upload was deliberately dropped from the public signup form.**
   Storage RLS on the `tenant-documents` bucket only allows `authenticated`
   writes keyed by `auth.uid()`; an anonymous tenant has none. Supporting
   photo/address-proof upload on `/signup/:token` needs a multipart route
   through the service-role client, plus size/MIME limits — real work, not a
   toggle. Until then the owner must attach both after the fact by editing the
   tenant record.

3. **Reports page property-scoping is code-verified only.** `reports.tsx`
   reads `usePropertyScope()` and filters its `bills-all` query by
   `selectedPropertyId` — confirmed by reading the source — but the page is
   gated to the Scale plan and the account used for testing was on Starter, so
   the actual click-through behavior has never been observed. Verify once an
   account with the Scale plan (or a plan-gate bypass) is available.

4. **No owner-facing notification when a tenant self-registers or files a
   complaint via the public links.** The owner only finds out by opening the
   Tenants/Complaints page or noticing the Dashboard widget. Given the stated
   use case (an owner bulk-onboarding 100+ existing tenants, expecting to see
   them land "in real time"), an email or WhatsApp ping to the owner on each
   signup/complaint submission is a reasonable next ask — not built.

5. **New, unaudited attack surface: two token-gated public write endpoints.**
   `/api/public/hooks/tenant-signup` and `/api/public/hooks/complaint-submit`
   are the first routes in this codebase where an anonymous browser writes to
   the database via the service-role client. The design intent (token
   resolved server-side before any query; vacancy re-checked at submit time to
   close a last-bed race; no RLS grant to `anon` on the link tables) is
   documented in the work log, but neither route has an automated test, and
   the Phase 1 cross-owner authorization matrix in `phases.md` was written
   before these routes existed and does not cover them. Worth a dedicated
   security pass before this feature sees real tenant traffic at volume.

6. **Two property-scoping regressions were found and fixed in the same
   session that introduced property scoping** — the Readings page's "Reading
   history" table and the Payments page's "Scheduled reminders" table were
   each missed when scope was threaded through their pages. Both are fixed,
   but it is worth grep'ing for any other secondary table on a scoped page
   that reads from a raw, unfiltered query instead of the already-scoped
   variable — the same mistake could exist elsewhere and would not be caught
   by a click-through of only the primary table on each page.
