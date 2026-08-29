# PGKhata error handling and reliability

Last verified against source: 2026-08-03

The repository has two layers with opposite postures. The new Express API has
real structure and thin coverage. The legacy web app has almost no error
handling and carries all the production traffic. This document describes both,
names the specific defects, and sets the target contract.

---

## The problem+json contract — Verified, with gaps

`apps/api/src/errors.ts` implements RFC 9457 (`application/problem+json`).

### What is implemented

**Request correlation.** `apps/api/src/app.ts` mounts the request-id middleware
**before** `pino-http`, so every log line and every error body carries the same
id:

```ts
request.requestId = request.get("x-request-id")?.slice(0, 128) || randomUUID();
response.setHeader("x-request-id", request.requestId);
```

A caller-supplied id is truncated to 128 characters rather than trusted
verbatim. The id is echoed on the response, so a user report maps to a log line.

**Validation errors.** `ZodError` becomes a 400 with a per-field map, keyed by
joined path, falling back to `body` for root-level issues:

```ts
const key = issue.path.join(".") || "body";
(errors[key] ??= []).push(issue.message);
```

**Information hiding.** Only explicitly constructed `ApiError` instances have
their message surfaced. Unknown errors log server-side and return a generic
`"An unexpected error occurred."` No stack trace leaks.

**Uniform route pattern.** Every handler wraps in `try/catch` and calls
`next(error)`, so both repository failures and inline `parse()` failures reach
the central handler:

```ts
const body = createPropertySchema.parse(request.body);
...
} catch (error) { next(error); }
```

**Fail-fast configuration.** `packages/config/src/index.ts` validates the
environment with Zod at module load. The process refuses to start with a
missing `DATABASE_URL` or a `BETTER_AUTH_SECRET` under 32 characters.

### Gaps

**E-1. The taxonomy is one class, used once.** `ApiError` carries
`status`/`title`/`message`/`type` and is constructed **exactly once** in the
entire API — the 401 in `apps/api/src/middleware/auth.ts`. There is no error
code enum, no domain subclasses, and no 403/404/409/422 variants. Every other
failure falls through as an unclassified 500, including the plain
`throw new Error("Property insert returned no row")` in the repository.

**E-2. The shared contract is unused.** `problemSchema` in
`packages/contracts/src/index.ts` is imported by nothing — a grep finds only its
own definition and type alias. `errorHandler` hand-builds the object literal, so
contract and implementation can silently drift. Contrast with the health
endpoints, which do `healthSchema.parse(...)` before responding.

**E-3. 429 breaks the content-type contract.** The rate limiter is mounted
before the routes and returns `express-rate-limit`'s default JSON body, not
`application/problem+json`. It is the one error response a client cannot parse
uniformly.

**E-4. Deliberate 5xx errors are not logged.** `errorHandler` logs only when the
error is *not* an `ApiError`:

```ts
if (!apiError) request.log?.error({ err: error }, "Unhandled request error");
```

A deliberately thrown 5xx `ApiError` loses its message and stack from the logs.
`pino-http` still records the request and status, so it is not invisible — but
the diagnostic content is gone.

**E-5. Readiness only probes Postgres.** `apps/api/src/server.ts` runs
`select 1` and returns true. Redis and the queue are never checked, so the API
reports ready while the entire async path is down.

**E-6. Draining instances still report ready.** `shutdown()` never flips
readiness to degraded before closing, so a load balancer keeps routing to an
instance that is shutting down.

**E-7. The force-exit timer cannot fire.** `setTimeout(() => process.exit(1), 10_000).unref()`
is unref'd, so it cannot itself hold the process open. It only force-exits if
some other handle is already keeping the event loop alive — which is the exact
case it was written for, but the guarantee is weaker than it reads.

**E-8. No process-level handlers.** A grep for `uncaughtException` and
`unhandledRejection` returns **zero hits across api, worker, and web.** Only
signal handlers exist.

**E-9. Env validation failure is unreadable.** `envSchema.parse()` throws a raw
`ZodError` stack with no operator-friendly message. Someone debugging a failed
deploy at 2am gets a stack trace instead of "REDIS_URL is not a valid URL."

Related: the worker loads the same env schema as the API, so it refuses to boot
without a 32-character `BETTER_AUTH_SECRET` despite never touching auth.

---

## Target error taxonomy

Standardize on these categories. Each maps to a status, a stable `type` URI,
and a decision about whether the detail is safe to show a user.

| Category | Status | Detail visible | Retryable |
| --- | --- | --- | --- |
| Validation | 400 | yes, per-field | no |
| Authentication | 401 | generic only | no |
| Authorization | 403 | generic only | no |
| Not found | 404 | resource kind only | no |
| Conflict / idempotency replay | 409 | yes | no — return the prior result |
| Provider failure | 502 / 503 | generic + request id | yes, with backoff |
| Internal | 500 | generic only | maybe |

Three rules that follow:

1. **Every response goes through `problemSchema.parse()`** before it is sent,
   including the rate limiter's. Closes E-2 and E-3.
2. **Log every 5xx regardless of class.** Closes E-4.
3. **Authorization failures are 403 with a generic detail**, never a message
   that reveals whether the resource exists. Combined with workspace scoping,
   a cross-workspace read and a genuine 404 must be indistinguishable.

---

## The transactional outbox — Partial

`apps/worker/src/outbox.ts` and `apps/worker/src/index.ts`.

### What is correct

The claim loop is properly written:

```ts
return db.transaction(async (tx) => {
  const events = await tx.select().from(outboxEvents)
    .where(and(eq(outboxEvents.status, "pending"), lte(outboxEvents.availableAt, now)))
    .orderBy(asc(outboxEvents.createdAt))
    .limit(100)
    .for("update", { skipLocked: true });
```

`FOR UPDATE SKIP LOCKED` means multiple worker instances can poll concurrently
without double-claiming. The poll loop survives failures — an exception is
logged and the interval continues — and shutdown clears the interval first,
then closes worker, queue, Redis, and the database connection in order.

BullMQ jobs get `attempts: 5` with exponential backoff from 1s.

### Where it loses events

**R-1. `jobId` drops the topic and sanitizes lossily.**

```ts
jobId: event.deduplicationKey.replace(/[^a-zA-Z0-9_-]/g, "_"),
```

The database unique index is on `(topic, deduplication_key)`. The BullMQ job id
uses the key alone, then replaces every non-alphanumeric character with `_`. So
`bill:123` and `bill_123` collapse into one job — as does the same key under two
different topics. BullMQ silently ignores a duplicate `jobId`, so **one event is
never delivered and nothing reports it.**

Fix: derive the job id from `topic + deduplicationKey` with a reversible
encoding, or hash the pair.

**R-2. Rows are marked published at enqueue time.**

```ts
await tx.update(outboxEvents)
  .set({ status: "published", publishedAt: now, attempts: sql`${outboxEvents.attempts} + 1` })
```

`published` means "handed to Redis," not "processed." A job that exhausts its
five retries leaves an outbox row that still reads `published`. Combined with
the next two points, a permanently failed job is a dead end with no record.

**R-3. `last_error` is never written and `failed` is never assigned.** The
`job_status` enum includes `failed`; no code path assigns it. The `last_error`
column exists in the schema and no code writes it. The failure-diagnosis
columns are decorative.

**R-4. `attempts` counts publishes, not deliveries.** It is incremented in the
same statement that marks the row published, so it always ends at 1.

**R-5. `queue.add` runs inside the database transaction.** Redis is not
transactional. If a later statement in the batch rolls back, jobs are already in
Redis. Deduplication covers the replay only until `removeOnComplete: 500` evicts
the job id.

**R-6. `available_at` supports deferral but nothing advances it.** There is no
backoff at the outbox layer — only inside BullMQ.

**R-7. The processor is a stub.** It logs and returns. The retry machinery
currently protects no real work, which is fine while modules are being migrated
— but means none of the above is exercised yet. Fix these before the first real
processor lands, not after.

**R-8. The worker has no error handler and no health endpoint.** It registers a
`failed` handler but no `error` handler on the Worker, Queue, or the IORedis
connection, so a Redis-level error event has no listener. And it exposes no HTTP
server, so a wedged or crash-looping worker is invisible to orchestration.

### What the outbox does and does not fix

It **does** close the legacy "send-then-log" race: the event row is written in
the same transaction as the domain change, so an event cannot be lost because a
follow-up write failed.

It **does not** replace database constraints. Deduplication of *business*
operations — one bill per tenant-month, one payment per idempotency key —
belongs in unique indexes, which the new schema has. The outbox deduplicates
*jobs*. Do not conflate the two.

---

## Legacy anti-patterns to retire

All five verified in current source. These are the reliability defects carrying
production traffic today.

### L-1. Payment recording is a non-atomic browser-issued two-step

`apps/web/src/lib/billing.ts`

```ts
const { error: insertError } = await supabase.from("payments").insert({...});
if (insertError) throw insertError;
return syncBillTotals(input.billId);
```

An insert followed by a separate read-modify-write of the bill aggregate, both
issued from the browser, with no transaction. A failure between the two leaves
the ledger and the bill divergent. There is no idempotency key, so a
double-submit inserts two payment rows.

The new schema fixes exactly this with a NOT NULL `idempotency_key` and a
workspace-scoped unique index.

Related: the Bills page "mark paid" shortcut bypasses `recordPayment` entirely
and writes `paid_amount` directly to the bill, leaving no payments row at all.

### L-2. Plan confirmation marks paid before it applies the plan

`apps/web/src/lib/plan.functions.ts`

```ts
if (payment.status === "paid") return { ok: true as const, plan: payment.target_plan };
...
.update({ status: "paid", ... })
...
if (upErr) throw upErr;   // settings update happens AFTER
```

The payment row is marked paid, then settings and history are updated. If the
settings update fails, a retry hits the early return and reports `ok: true`
while the owner remains on the old plan — a silent, permanent wrong state.

Fix: apply payment, plan, and history in one transaction, keyed by a
retry-safe idempotency key, with provider verification first (see `security.md`
S-5).

### L-3. Reminder deduplication is check-then-act

`apps/web/src/lib/reminders.server.ts`

```ts
const last = lastReminder.get(bill.id);
if (last === today) { result.skipped += 1; continue; }
```

The map is built from `notification_logs`, which has only a primary key — no
unique constraint on `(bill_id, day)`. Two concurrent runs both pass the guard
and both send.

Fix: a database unique send key. An in-memory pre-check is an optimization, not
a guarantee.

### L-4. Supporting-query failures become silent skips — or duplicate sends

The reminder run fans out four queries and **never checks their errors**:

```ts
const [propertiesRes, settingsRes, tenantsRes, logsRes] = await Promise.all([...]);
// no r.error check follows
```

Worse, the rooms query discards its error object entirely:

```ts
const { data: rooms } = await supabase.from("rooms").select("id, room_number");
```

Two failure modes follow. A failed `tenants` query empties the map and every
bill is counted as a silent skip — the run reports success having sent nothing.
A failed `logsRes` leaves `lastReminder` empty, which **disables both the
same-day guard and the three-day cooldown**, turning a read failure into
duplicate emails.

Compare `runMonthlyBilling`, which does it correctly:

```ts
for (const r of [admins, properties, rooms, tenants, settings, existing, readings]) {
  if (r.error) throw new Error(r.error.message);
}
```

Related: the `notification_logs` insert that the entire dedup scheme depends on
is fire-and-forget in `email.server.ts` — its error is discarded. A send that
succeeds but fails to log will be re-sent on the next run.

### L-5. Error capture is a global monkey-patch with a shared slot

`apps/web/src/lib/error-capture.ts` overrides `console.error` globally and
stores the recovered error in a single module-scoped variable with a 5-second
TTL. Under concurrent SSR, one request's 500 page can display another request's
captured error.

The mechanism exists because h3 swallows in-handler throws into a generic 500
JSON body that `try/catch` never sees — `apps/web/src/server.ts` sniffs that
exact body shape to recover it:

```ts
return payload.unhandled === true && payload.message === "HTTPError";
```

A real constraint, but the current workaround is not concurrency-safe. Moving
these paths to `apps/api` removes the need for it entirely.

Also: the legacy 500 page carries no correlation id, unlike the API's problem
documents. A user report has nothing to tie back to a log line.

### What legacy does right

Two things worth keeping.

`runMonthlyBilling` is genuinely idempotent — it checks every result for errors
and its upsert is backed by a real unique index rather than an
application-level check:

```ts
.upsert(rows, { onConflict: "tenant_id,bill_month", ignoreDuplicates: true })
```

The index it relies on is real, created by
`20260801202513_*.sql` after de-duplicating existing rows.

And both cron hooks wrap their run in `try/catch` and return a 500 JSON body,
so scheduled failures are at least visible to the caller — better than the
server-function paths, which have essentially no `try/catch` at all. A grep
across `apps/web/src/lib` finds five hits total, two of them in unrelated files.
The taxonomy there is bare `throw new Error(string)`.

---

## Test coverage — Partial

- `apps/api` — one integration file, five cases, behind an 80% coverage
  threshold. Covers liveness, readiness failure, unauthenticated rejection,
  workspace-scoped create-and-list, and field validation errors.
- `apps/worker` — declares a `test` script; **has no tests directory.**
- `apps/web` — **zero tests, no test script.** This is the code serving users.

The five API tests are a good shape to copy: they use the app factory with fake
dependencies, so no database or network is needed, and they assert on the
problem+json contract rather than just the status code.

---

## Operational surface — target

**Health.** `/health/live` stays trivial. `/health/ready` must probe Postgres
**and** Redis, and must return degraded during drain. The worker needs its own
liveness endpoint.

**Shutdown.** Flip readiness to degraded, stop accepting new work, drain
in-flight requests and jobs, then close connections in dependency order. Keep
the force-exit fallback but do not rely on the unref'd timer alone.

**Logging.** Structured pino with request-id correlation on every line. Fix the
redaction gaps named in `security.md` N-5 — pino redact paths are literal, so
nested and differently-named secrets pass through, and `DATABASE_URL` /
`REDIS_URL` embed credentials and are not redacted at all.

**Process-level safety.** Add `uncaughtException` and `unhandledRejection`
handlers that log and exit non-zero, in all three applications. A crash that
leaves the process running in an undefined state is worse than a restart.

**Startup.** Wrap `loadEnv()` so a validation failure prints which variables
are wrong, without printing their values.
