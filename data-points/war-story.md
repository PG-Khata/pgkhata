# PGKhata war story: controlling scope in an AI-generated product

Last updated: 2026-08-03

## 60-second version

I started PGKhata after noticing that PG owners manage rent, electricity,
tenant documents, and payment follow-ups through notebooks and individual
WhatsApp chats. I chose a narrow model: the owner uses the product, while the
tenant should not need another app or login.

I used Claude to challenge the cost and architecture, and Lovable to turn the
idea into a working application quickly. That speed created a new problem: the
generated product expanded into multi-property management, subscriptions,
automation, and a super-admin console before the core WhatsApp and UPI flow was
actually complete. Some product copy also described behavior the code did not
yet support.

I exported the code and changed the way I worked. I audited the repository
against the original intention, separated implemented, partial, and planned
features, identified security and reliability risks, and put the application
under a project-only Git boundary. The main lesson was that AI can produce
breadth very quickly, but I am still responsible for product scope, evidence,
security, and what I honestly call complete.

## Detailed version

### Situation

The operating problem was concrete: a PG owner may have dozens of tenants, but
billing and records are scattered across paper registers, spreadsheets, phone
galleries, and WhatsApp. Every month the owner repeats the same calculation and
follow-up work. Tenants do not want another portal, so the product needed to fit
the owner's workflow and communicate through channels tenants already use.

I also had a practical constraint: keep early operating cost close to zero
until real owners prove that the workflow is valuable.

### Task

My original MVP was intentionally small:

- owner authentication;
- property, room, and tenant records;
- rent and electricity billing;
- an itemised bill sent to the tenant;
- a simple paid-versus-pending collection view.

My job was not only to get screens generated. I needed to make the resulting
system match that scope, distinguish real integrations from UI claims, and
decide what was safe enough to test with actual owner and tenant data.

### Action

I used AI tools for different jobs and kept ownership of the decisions:

1. I gave Claude the business problem, owner-only model, expected scale, and
   cost constraint. It helped compare hosting, database, notification, payment,
   and backup options and helped draft the initial scope.
2. I used Lovable to generate and iterate on the application. It produced much
   more than the narrow MVP, including reporting, plan management, automated
   billing code, theming, and a platform console.
3. Instead of treating generated breadth as completion, I exported the source
   and audited it. I compared routes, server functions, migrations, integrations,
   and product copy with the original intention and the AI chat claims.
4. I classified features as implemented, partial, planned, or unsupported.
   For example, email billing exists, but WhatsApp delivery and automatic UPI
   reconciliation do not. Monthly bill generation exists, but its scheduled
   request currently uses the wrong authentication header.
5. I prioritized security and integrity issues before new scope. The most
   serious finding was that two ordinary owner-authenticated server functions
   could start service-role jobs across every owner. I also found non-atomic
   payment/plan updates, incomplete notification deduplication, and no automated
   tests.
6. I created an explicit Git boundary inside the application folder so private
   research notes and AI transcripts stay outside version control, and I made
   sure local environment files are ignored.

### Result

The immediate result is not a claim that the SaaS is production-ready. It is a
more trustworthy project state:

- current behavior is documented from source rather than promotional copy;
- the proposed backend rewrite is clearly labeled as a future decision;
- the core security and data-integrity risks have an ordered remediation list;
- raw AI conversations remain evidence instead of being rewritten as history;
- future changes can be reviewed through small, scoped Git commits.

The next meaningful product result should come from fixing the highest-risk
authorization paths, completing one real tenant delivery/payment loop, and
testing that workflow with a small number of PG owners in Noida.

## What I personally owned

- The problem selection and owner-only product model.
- The narrow MVP, low-cost constraint, and decision not to require tenant
  accounts.
- The choice to use AI tools and the prompts/direction given to them.
- The decision to stop feature expansion and audit the exported repository.
- The final judgment about what is implemented, what is risky, and what should
  be built next.

## What AI contributed

- Claude contributed architecture/cost comparisons and early planning drafts.
- Lovable generated most of the current application and reported iterative UI
  and feature changes.
- Codex inspected the exported source, ran static checks, reconciled the
  documentation, and helped identify risks.

I should not claim that I manually authored every generated component or
migration. A truthful description is: I directed the product, used AI to
accelerate implementation, and took responsibility for auditing and deciding
what could be trusted.

## Lessons I would carry forward

- A generated screen is not evidence that the underlying workflow works.
- Product copy should be tested against integrations and database behavior.
- Authorization for a service-role operation must be explicit; authentication
  alone is not sufficient.
- Idempotency needs database guarantees and concurrency tests, not only an
  in-memory pre-check.
- A rewrite should solve a verified constraint. It should not replace the work
  of stabilizing product invariants.
- AI work needs an evidence log so later explanations stay honest.

## Interview follow-up answers

**Why did the scope expand?**

The generation tool made adding adjacent screens inexpensive, so the product
looked more complete quickly. I had not yet installed a strict acceptance gate
that tied every feature to the core owner-to-tenant workflow. The audit exposed
that, and I changed the process.

**What was the hardest technical finding?**

Two server functions accepted any authenticated owner and then created a
service-role client that operated across all accounts. The lower-level jobs
were designed as platform-wide tasks, but the entry points did not enforce a
platform role. That is a tenant-isolation issue, not just a UI bug.

**What would you do next?**

First scope or restrict those privileged jobs, align cron authentication, and
add cross-owner authorization tests. Then make payment and plan updates atomic,
complete one supported notification/payment channel, and validate the narrow
workflow with real owners before expanding features.
