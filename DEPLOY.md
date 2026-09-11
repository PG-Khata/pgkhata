# Deployment

Three deployables from one repo, all building from `main`:

| App | Host | Config |
|---|---|---|
| `apps/api` (Express) | Render — `pgkhata-api` | `render.yaml` |
| `apps/web` (owner app) | Render — `pgkhata-web` | `render.yaml` |
| `apps/admin` (platform console) | Vercel | `apps/admin/vercel.json` |

Database migrations run inside the API's **build command**, not as a
`preDeployCommand` — pre-deploy is a paid-plan Render feature and this service
is on free. `migrate:deploy` rehearses every pending migration in a rolled-back
transaction and verifies applied history hashes before committing, and running
it before the build means a failed migration aborts the deploy with the previous
version still serving.

> `render.yaml` is a Blueprint: it only governs services **created from it**. If
> a service was set up through the dashboard, editing this file changes nothing —
> the Build Command must be updated in Render → Settings → Build & Deploy to
> match. This bit us once: migrations silently never ran in production.

Because the schema lands seconds before the code that uses it, migrations must
stay backward-compatible with the running version — add columns and tables, and
never drop or rename in the same deploy that starts relying on the change.

---

## Admin console on Vercel

The admin app is a separate Vercel project pointed at this monorepo.

**Project settings**

- Root Directory: `apps/admin`
- Framework preset: Next.js (auto-detected)
- Build/install commands come from `apps/admin/vercel.json` — leave the UI
  overrides off.

**Environment variables** (Production + Preview)

| Variable | Value | Why |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | the API's public URL, e.g. `https://pgkhata-api.onrender.com` | Used by `next.config.ts` to rewrite `/api/backend/*` to the API. Without it the rewrite falls back to `http://localhost:3001` and every request fails. |
| `API_URL` | same value | Used **server-side** by `src/proxy.ts` and the `(admin)/layout.tsx` gate, which call `/v1/admin/me` to prove platform-admin status before rendering. Without it the console redirects everyone to `/login`. |

Both are required. They are deliberately not hardcoded in `vercel.json`, because
the server-side gate and the client-side rewrite must agree, and a value baked
into the repo drifts from whatever the API is actually deployed at.

---

## Cross-origin wiring

The admin console signs in against the same Better Auth instance as the owner
app, proxied through its own origin. Two API-side variables must know about it:

| Variable (on the API) | Must include |
|---|---|
| `CORS_ORIGIN` | the admin origin, e.g. `https://admin.pgkhata.com`, alongside the owner app origin (comma-separated) |
| `ADMIN_URL` | the admin origin — where "Exit support session" returns to |

`CORS_ORIGIN` feeds Better Auth's `trustedOrigins`. If the admin origin is
missing from it, sign-in from the admin console is rejected even though the
credentials are correct.

`ADMIN_URL` has no safe default: it falls back to `http://localhost:3002`, so
omitting it leaves a dead exit link in production rather than an obvious error.

---

## Impersonation: why the cookie is host-only

A support session is carried by an `httpOnly` cookie (`pgk_imp`) set on the
**owner app's** origin, not on a shared parent domain. The admin console hands
off via a single-use 60-second token in a redirect, which the owner app
exchanges server-side at `/impersonate/start`.

This is deliberate. A `Domain=.pgkhata.com` cookie would be sent to every
current and future subdomain, turning any XSS anywhere under the apex into an
admin-grade credential — and it cannot work at all on Vercel preview
deployments, since `*.vercel.app` is a public suffix and browsers reject domain
cookies there. The handoff works identically in preview and production.

Consequence worth knowing: during a support session there is no Better Auth
session on the owner origin, so `/api/auth/*` is unreachable. An admin acting as
an owner structurally cannot change that owner's password.

---

## First-time setup after migrating

`platform_admin` rows that predate roles are backfilled to `super_admin` by
migration `0027`. If there are none, promote a user who has already signed up:

```
npx tsx scripts/promote-platform-admin.ts <email> super_admin
```

`scripts/` is gitignored, so this runs from a working copy, not from a deploy.
