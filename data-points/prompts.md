# PGKhata prompt library

Last updated: 2026-08-03

Reusable prompts for AI-assisted work on this project. Each entry states what
it is for, the prompt itself, and the acceptance check that makes the output
trustworthy. The acceptance check is the important half — a prompt without one
produces confident text you cannot act on.

For the historical record of prompts already used, read the raw transcripts:
`claude-desktop-chat.txt`, `lovable-chat.txt`, `codex-chat.txt`, and the three
roast transcripts. Those are evidence and stay unchanged.

---

## House rules

These apply to every prompt below and to any AI work on this project. They come
from `AI-work-log.md` and from what actually went wrong.

1. **Chat output is never proof.** "I implemented X" is a claim. Source, a
   passing test, or a live integration check is evidence. The gap between the
   two is exactly how this project ended up with marketing copy for features
   that do not exist.
2. **Never paste secrets.** No `.env` contents, service-role keys, API tokens,
   or private tenant data into any prompt or into `data-points`. A publishable
   key already ended up committed in migration SQL; do not widen the exposure.
3. **Record failed checks.** A blocked build stays "blocked verification." Do
   not let a partial result become a success in the retelling.
4. **Label every claim** — Verified, Partial, Planned, Not implemented.
5. **Keep raw transcripts unchanged** so summaries can be checked against them.
6. **A generated screen is not a working workflow.** Ask what the code does,
   not what the UI implies.

---

## 1. Repository audit against intention

**For:** periodically checking whether the code still matches what you set out
to build. Run after any burst of AI-generated work.

```
Read the codebase at <path> and the founder intention in
data-points/intention.txt.

Produce three lists, each item citing a file path and a short verbatim snippet:

1. IMPLEMENTED — features that work end to end in the current source.
2. PARTIAL — features with UI, schema, or settings but no working path. Say
   exactly what is missing.
3. CLAIMED BUT ABSENT — anything promised in marketing copy, pricing, route
   text, or a prior document that you cannot find in code.

Rules:
- If you cannot find evidence, write "NOT FOUND: <claim>" as a finding. Do not
  soften it into a maybe.
- A settings column, a database enum, or a UI toggle is not an implementation.
  Trace to the code that actually sends, writes, or charges.
- Do not treat a prior audit or a chat transcript as evidence. Re-check.
```

**Acceptance check:** open three cited paths yourself at random and confirm the
snippet is there. If any citation is wrong, discard the whole audit — a
fabricated citation means the rest was not read either.

---

## 2. Claim-to-code gap check

**For:** narrower and faster than a full audit. Use before a demo or before
writing anything customer-facing.

```
Here is a specific claim about <project>: "<claim>".

Verify it against the source at <path>. Answer in this form:

VERDICT: CONFIRMED | PARTIAL | FALSE
EVIDENCE: <file path>:<line> plus a verbatim snippet
REALITY: one sentence describing what the code actually does

Default to FALSE if you cannot find supporting code. Do not infer from naming,
comments, or database columns — a column named upi_qr_code_url is not a QR code
generator.
```

**Acceptance check:** the verdict must cite a path and line. "It appears that"
is a failed answer.

---

## 3. TDD vertical slice

**For:** adding a module to `apps/api`. This is the main build prompt for
Phase 4.

```
Add a <module> module to apps/api following the existing properties module
exactly.

Read these first and match their shape:
- apps/api/src/modules/properties/routes.ts
- apps/api/src/modules/properties/repository.ts
- apps/api/src/types.ts
- apps/api/tests/integration/app.test.ts
- packages/contracts/src/index.ts
- packages/db/src/schema.ts

Work in this order, strictly:
1. Add Zod contracts to packages/contracts. Types are derived from schemas,
   never hand-written alongside them.
2. Write failing integration tests using the app factory with fake
   dependencies — no database, no network. Cover: unauthenticated 401,
   cross-workspace isolation, happy path, and field validation errors.
3. Only then write the repository and routes to make them pass.

Non-negotiable constraints:
- The repository hardcodes the workspace filter. Routes never read a workspace
  id from the request body — only request.identity!.workspaceId.
- Errors go through next(error) to the central handler. No ad-hoc responses.
- Every response validates against its contract schema before sending.
- No new dependency without saying why an existing one does not work.

Show me the failing tests before writing the implementation.
```

**Acceptance check:** the tests must fail first, for the right reason. A test
that passes before the implementation exists is testing nothing. Then run
`pnpm --filter @pgkhata/api test` and confirm the cross-workspace case is
present — not just the happy path.

---

## 4. Legacy module → Express slice

**For:** moving behavior out of `apps/web` without changing it.

```
Migrate <feature> from apps/web to apps/api.

Step 1 — characterize. Read the current implementation in
apps/web/src/lib/<feature>.server.ts and its routes. Write down exactly what it
does today, including the quirks and the bugs. Do not fix anything yet.

Step 2 — characterization tests. Write tests that pin the CURRENT behavior,
quirks included. These must pass against today's code.

Step 3 — reimplement in apps/api following the properties module shape, making
the characterization tests pass against the new implementation.

Step 4 — list separately, do not silently fix: every bug you found in step 1,
and every behavior you deliberately changed with the reason.

Watch for these known traps in this codebase:
- Billing math is duplicated in three places with three copies of the cycle-date
  helpers. Find all copies before assuming one is canonical.
- Some paths use the caller-scoped Supabase client (RLS applies) and some use
  the service-role client (RLS bypassed). They are not interchangeable.
- The legacy schema enforces almost nothing; the new schema has CHECK
  constraints. Data that was legal before may be rejected now.
```

**Acceptance check:** step 4 must be non-empty. A migration that found no bugs
and changed no behavior did not read the code.

---

## 5. Security review

**For:** before shipping anything that touches auth, money, or tenant data.

```
Security-review <scope> in <path>.

For each finding report: file path, verbatim snippet, concrete exploit scenario
with inputs, impact, and fix.

Prioritize in this order:
1. Cross-tenant access — can owner A reach owner B's data, or trigger a job
   that affects it?
2. Privilege escalation — does any authenticated-but-not-authorized path reach
   a service-role or admin operation?
3. Missing server-side enforcement of a UI-only rule.
4. Non-atomic money operations and non-idempotent retries.
5. Injection, including into outbound email HTML.

Rules:
- Rank by exploitability, not by how alarming it sounds.
- Report existing controls too — I need to know what must survive a refactor.
- No finding without a concrete failure scenario. "Could be improved" is not a
  finding.
```

**Acceptance check:** run the adversarial verification prompt below on every
critical and high finding before acting on it.

---

## 6. Adversarial verification

**For:** checking a single finding or claim. Run this on anything before it
becomes a task. This is what caught the incorrect cascade claim in
`Database.md`.

```
Adversarially verify one claim about <repo>.

CLAIM: <claim>
CLAIMED FILE: <path>
CLAIMED EVIDENCE: <snippet>

Open the file yourself and check. Answer:

GROUNDED: true | false
CORRECTION: <if false, the corrected statement, or "REMOVE" if the file or
behavior does not exist>

Default to false if you cannot find the evidence at that path. If the claim is
directionally right but the detail is wrong, that is false — give the precise
version.

Be skeptical. A wrong fact in a planning document is worse than a missing one,
because someone will act on it.
```

**Acceptance check:** none needed — this *is* the check. Run several
independently for high-stakes claims; agreement across independent runs is
worth more than one confident answer.

---

## 7. Schema mapping and cutover rehearsal

**For:** Phase 5, and for keeping `Database.md` current.

```
Compare the legacy schema in apps/web/supabase/migrations/*.sql against the new
Drizzle schema in packages/db/src/schema.ts.

Produce:
1. A table-by-table mapping, naming the join key.
2. Every column present in legacy and absent in new. Flag anything monetary or
   legally required — those are data loss, not cleanup.
3. Every legacy table with no new equivalent, and what breaks without it.
4. Constraints the new schema adds that legacy data may already violate. For
   each, the query that finds violating rows.
5. Default changes between the two — a column that was nullable and is now NOT
   NULL, or a default that flipped.

Then write the reconciliation checklist: record counts, monetary totals,
relationship integrity, object checksums.

Order matters: if a new constraint would reject existing data, the reconciliation
must run BEFORE the constraint is applied. Say so explicitly for each.
```

**Acceptance check:** run the violation queries against a production copy
before believing the mapping. `bills.paid_amount` is known to be client-computed
and may already disagree with `SUM(payments.amount)`.

---

## 8. Documentation honesty pass

**For:** after any document is written or updated, including by you.

```
Review <document> against the source at <path>.

For every factual claim:
- Confirm the cited file exists and the snippet is accurate.
- Confirm the status label (Verified / Partial / Planned / Not implemented) is
  correct.
- Flag any sentence implying something works when the code shows otherwise.

Pay attention to completion language — "supports", "handles", "provides",
"integrates". Each must be backed by a Verified label and a real path.

Report every unearned claim with the corrected wording.
```

**Acceptance check:** grep the document for completion verbs yourself and spot
check three. This document set exists because that check was not being run.

---

## 9. Business-assumption stress test

**For:** before building on an assumption about how PG owners actually behave.
The three roast transcripts are the precedent — they found real gaps that no
code review would have.

```
Here is a plan: <plan>. Here is the market context: <context>.

Argue against it. Specifically:
- Which technical choice creates a dependency that can be revoked by someone
  else — a platform ban, a policy change, an expiring free tier?
- Which assumption about user behavior is convenient rather than observed?
- Where does the plan solve the problem I find interesting instead of the one
  the customer feels most?
- What does the pricing assume about willingness to pay that has not been
  tested?

Be blunt. Then, separately, say what is genuinely sound — I need to know what
to keep, not just what to cut.
```

**Acceptance check:** treat the output as hypotheses to test with real owners,
not as instructions. Three reviewers independently flagged the WhatsApp bridge;
that convergence was the signal, not any single argument.

---

## 10. Work log entry

**For:** after any AI-assisted session. Keeps `AI-work-log.md` honest.

```
Write an AI-work-log entry for this session using the template in
data-points/AI-work-log.md:

- Tool/model
- Founder direction and acceptance criteria
- Files or systems in scope
- AI-produced change
- Human decision or correction
- Verification performed
- Result: Verified | Chat-reported | Planned | Not implemented | Blocked verification
- Known limitations or risks
- Commit hash (application only)

If a check did not complete, the result is "Blocked verification" — say why.
Never record an intended outcome as a verified one. Include what you got wrong
this session; a log with no corrections is not a log.
```

**Acceptance check:** if the entry contains no limitation and no correction, it
is incomplete. Every real session has both.
