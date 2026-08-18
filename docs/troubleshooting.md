# Troubleshooting guide

Use a disciplined sequence:

```text
observe → scope → reproduce → hypothesize → inspect → change one variable → verify → prevent regression
```

Do not begin by deleting everything or adding arbitrary waits.

## Setup and Docker

### Port already allocated

```bash
docker compose ps
lsof -i :3000
lsof -i :8000
lsof -i :5432
```

Stop the conflicting process or change the host port in local environment/config. Container ports and host ports are different concepts.

### Backend waits or restarts

```bash
docker compose ps
docker compose logs db backend --tail=200
docker inspect <backend-container> --format '{{json .State.Health}}'
```

Check database health, connection URL host (`db`, not `localhost` inside backend), migration failure, secret validation, and file permissions.

### Frontend cannot call API

Determine where the request originates:

- browser request uses `NUXT_PUBLIC_API_BASE` and must be reachable from the host/browser;
- server-side Nuxt request uses `NUXT_INTERNAL_API_BASE` and should use Docker DNS locally.

Inspect browser network, frontend logs, backend CORS logs/response, and runtime config without printing secrets.

### Old database schema or seed

```bash
docker compose exec backend alembic current
docker compose exec backend alembic history
make clean && make up
```

`make clean` drops the disposable Postgres volume (and only that data); `make up` rebuilds and reapplies migrations from scratch. Reset only disposable local data. Never treat volume deletion as a production migration strategy.

## Backend

### `401 Unauthorized`

Check Authorization header format, token expiry/type, signing key consistency, current user activity, and whether the frontend attempted one refresh. Do not log the full token.

### `404` for an existing private resource

The API may deliberately return resource-scoped `404` when the caller lacks access. Test with the correct user before assuming the identifier is wrong.

### Migration autogenerate is empty

Ensure all models are imported into Alembic metadata, the correct database URL is loaded, model metadata changed, and the current database is at head. Run `alembic check`.

### SQLite test passes but PostgreSQL fails

Inspect PostgreSQL-specific type/constraint/query behavior. Add a PostgreSQL-backed integration test rather than changing production behavior to match SQLite.

## Frontend

### Hydration mismatch

Look for server/client differences: current time, random values, browser-only globals, locale-dependent output, auth state initialized only client-side, or data fetched differently. Make initial render deterministic.

### Middleware loop

Verify auth initialization state is distinct from unauthenticated state. Preserve intended return route and avoid redirecting login/register pages to themselves.

### Component test cannot find element

Prefer accessible role/name or a deliberate domain test ID. Check whether rendering is conditional, async state is awaited, or the component requires Nuxt context.

## Playwright

### Timeout/flaky journey

- inspect trace and screenshot;
- confirm service readiness;
- remove test data collisions;
- wait for a user-visible state or response;
- use unique email/project values;
- avoid fixed sleeps;
- ensure package version matches Playwright Docker image.

### Test works locally but not CI

Check architecture/browser image, hostnames inside Compose, permissions on mounted artifact directories, headless assumptions, time zone/locale, and shared test state.

## GitHub Actions

### OIDC authentication fails

Check `id-token: write`, checkout before auth, exact workload provider resource name, exact repository claim/condition, service-account IAM binding, protected environment approval, and IAM propagation. Do not fall back to a key JSON as the first response.

### Container push denied

Check Artifact Registry repository/region, deployer `artifactregistry.writer`, Docker registry authentication host, project selection, and image name.

## Cloud Run and Cloud SQL

### Backend revision not ready

```bash
gcloud run services describe workboard-api --region "$GCP_REGION"
gcloud run revisions list --service workboard-api --region "$GCP_REGION"
gcloud logging read 'resource.type="cloud_run_revision"' --limit=50
```

Check port, startup command, secret access, database URL socket path, Cloud SQL instance attachment, runtime service account, migration state, and connection limits.

### CORS works locally but not cloud

Inspect the exact browser Origin including scheme and host. Update JSON origin list to the deployed/custom frontend origin. CORS is a browser policy; a successful server-to-server `curl` does not prove browser access.

### Rollback does not recover backend

Determine whether the database migration is incompatible with the previous revision. Shift traffic only to a revision that can operate against the current schema, or execute the tested corrective migration.

## Escalation template

Provide:

- objective and expected behavior;
- exact revision/branch/environment;
- smallest reproduction and commands;
- relevant status/log excerpt with secrets removed;
- hypotheses already tested;
- change that introduced the issue, if known;
- impact and safe workaround.
