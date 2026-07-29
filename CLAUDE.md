# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

This is **both a software project and a curriculum**. It is the learner starter export for a full-stack intern workshop that builds "Workboard" (a project/task tracker) from a minimal health-check skeleton up to an authenticated, deployed, tested application across modules `workshop/00-*.md` through `workshop/19-*.md`. The course map with module order, gates, and expected artifacts is in `COURSE_MAP.md`.

The starter is **deliberately incomplete** — see `STARTER_SCOPE.md`. There is no auth, no users/projects/tasks domain, no migrations, and no production-grade test suites yet; those are the graded learning outcomes of modules 03–18. Do not "complete" the app by copying in a full reference implementation — module-sized, explained, tested changes are the point.

Full instructions for coding agents working in this repo are in `AGENTS.md` — read it before making non-trivial edits. Key rules from it:

- Identify whether a change affects the reference solution, starter snapshot, course text, CI, or cloud runbooks *before* editing.
- Preserve frontend/backend deployment separation and API versioning.
- Never introduce secrets or generated cloud state.
- Prefer explicit, teachable code over abstraction that only reduces line count.
- After editing: update tests/docs, run `python scripts/validate-starter.py .`, run narrow component tests, then `make verify`-equivalent (`make test`) where Docker is available, and record any validation that could not be run.

## Commands

```bash
cp .env.example .env        # first-time env setup
make setup                  # verify git/docker/docker-compose, create .env
make up                     # docker compose up --build -d, then ps
make down                   # docker compose down
make logs                   # follow logs, tail 150
make ps                     # service status
make backend-test           # docker compose run --rm backend pytest
make frontend-test          # docker compose run --rm frontend npm run typecheck
make test                   # backend-test + frontend-test
make clean                  # docker compose down -v --remove-orphans (drops DB volume)
make validate                # python3 scripts/validate-starter.py . (starter export integrity)
```

Single backend test: `docker compose run --rm backend pytest tests/test_health.py::test_live_health_does_not_require_database`.

Frontend has no dedicated dev-server or lint script defined yet in `frontend/package.json` beyond `dev`, `build`, `typecheck`, `postinstall` — typecheck (`nuxt typecheck`) is the current frontend gate.

Service URLs once running: frontend `http://localhost:3000`, backend liveness `http://localhost:8000/health/live`, backend readiness `http://localhost:8000/health/ready`, OpenAPI docs `http://localhost:8000/docs`.

`compose.test.yaml` defines the ephemeral acceptance stack (`db-test`, `backend-test`, `frontend-test`, `e2e`) used by later modules for Playwright/E2E runs — production images, no host DB port, torn down after the run.

## Architecture

Full detail with diagrams lives in `docs/architecture.md`; the essentials:

- **Nuxt service** (frontend): HTML rendering, browser interactions, frontend runtime config.
- **FastAPI service** (backend): external API contracts, auth, business rules, persistence coordination.
- **PostgreSQL**: durable relational state and constraints.

This is a modular monolith split into two independently deployable services, not microservices — no queues, caches, or service mesh by design.

Backend layering (enforced by `AGENTS.md`): **Router** (HTTP concerns, no SQL/business logic) → **Schema** (Pydantic, external contract, distinct from DB models) → **Service** (business rules, transactions) → **Repository** (query mechanics only) → **Model** (SQLAlchemy persistence structures). Database changes require Alembic migrations (introduced in module 06).

Frontend layering: **Page** (route-level composition, public pages may fetch during SSR) → **Component** (focused UI contract via props/events) → **Composable/service** (reusable request behavior, wraps `$fetch`) → **Pinia store** (only for genuinely shared state, e.g. auth — project/task data stays page-local).

Local vs. container networking distinction that recurs throughout the course: the **browser** calls `localhost:8000`; **server-side Nuxt rendering** calls the Docker DNS name `backend:8000`. `NUXT_PUBLIC_API_BASE` is the public/browser base; the internal SSR base differs in production (Cloud Run URL vs. Docker DNS).

Current backend code (`backend/app/`): `main.py` exposes `/health/live` (no DB dependency) and `/health/ready` (checks DB via `db/session.py:database_is_ready()`); `core/config.py` holds `pydantic-settings`-based `Settings` (env-driven, cached via `lru_cache`). This skeleton is what modules 05+ build the domain layers on top of.

Configuration boundaries (local → production source) are tabulated in `docs/architecture.md`: DB URL and signing key come from Compose env locally, Secret Manager in production; CORS/cookie-secure flags differ by environment. Secrets must never be passed as Docker build args or embedded in Nuxt public runtime config.

## Docs worth knowing about before larger changes

- `docs/decision-records/` — ADRs (FastAPI over Django, Nuxt over SPA-only Vue, monorepo/two-deployables, Cloud Run over Kubernetes, JWT access + cookie refresh).
- `docs/api-contract.md`, `docs/database-design.md`, `docs/testing-strategy.md`, `docs/security.md`, `docs/deployment.md`, `docs/operating-runbook.md`, `docs/troubleshooting.md`, `docs/cost-control.md`.
- `VERSION_MATRIX.md` — pinned tool/runtime versions for the course.
- Production images run as non-root users; CI/CD uses workload identity federation (no stored GCP key JSON) — see `.github/workflows/deploy-gcp.yml` and `infrastructure/gcp/`.
