# Handover index

Single real entry point for operating, extending, or auditing this system. Written for another engineer with no private verbal context - every claim below points at a real artifact in this repository, not a summary that has to be taken on faith.

## Quick start and commands

- [README.md](../README.md) - orientation, learning path, starter architecture.
- [CLAUDE.md](../CLAUDE.md) - commands (`make setup`/`up`/`down`/`test`/`verify`), service URLs, architecture summary.
- Real, current caveat: `make` is not on `PATH` in every environment (confirmed absent in this one). `scripts/setup.sh` detects this and prints the real remediation; `Makefile` documents the exact underlying `docker compose` command for every target if `make` is unavailable.

## Architecture and decisions

- [docs/architecture.md](architecture.md) - service boundaries, layering, local vs. container networking.
- [docs/decision-records/](decision-records/) - all 7 real ADRs:
  - [001-fastapi-over-django.md](decision-records/001-fastapi-over-django.md)
  - [002-nuxt-over-spa-only-vue.md](decision-records/002-nuxt-over-spa-only-vue.md)
  - [003-monorepo-two-deployables.md](decision-records/003-monorepo-two-deployables.md)
  - [004-cloud-run-over-kubernetes.md](decision-records/004-cloud-run-over-kubernetes.md)
  - [005-jwt-access-and-cookie-refresh.md](decision-records/005-jwt-access-and-cookie-refresh.md)
  - [006-refresh-token-rotation-and-revocation.md](decision-records/006-refresh-token-rotation-and-revocation.md) - **design-only, not implemented** (see risk register).
  - [007-cloud-run-cross-origin-session-topology.md](decision-records/007-cloud-run-cross-origin-session-topology.md) - **recommendation not built** (see risk register).
- [docs/glossary.md](glossary.md).

## API and database

- [docs/api-contract.md](api-contract.md) - external API contract.
- [docs/database-design.md](database-design.md) - schema, relationships, constraints.
- Real migration history: `backend/migrations/versions/` - `27edc82c2b1b` (initial schema), `4840454901bd` (project_id/status index on tasks). Verified this module: both apply cleanly to a genuinely empty database and reverse cleanly (`alembic downgrade base` / `upgrade head`).
- Live API docs: `/docs` on the running backend (OpenAPI/Swagger).

## Tests and current evidence

- [docs/testing-strategy.md](testing-strategy.md) - what belongs at which layer, and what each layer does not prove.
- Real, current backend evidence (this module, against the fixed candidate revision): 56/56 tests pass in 72.91s; lint/format/mypy clean; real branch coverage **94.76%** (`pytest --cov=app --cov-branch`, `90.0%` required threshold met). Real, honest coverage gaps: `app/services/projects.py` at 90% (lines 70, 80, 87 uncovered), `app/services/tasks.py` at 95% (73->81, 89 uncovered), `app/repositories/tasks.py` at 89% (18, 32->34 uncovered) - named specifically rather than hidden behind the aggregate number.
- Real, current frontend evidence: 55/55 tests across 9/9 suites; lint/typecheck clean; production build succeeds.
- Real mutation-testing evidence (this module): one backend rule (`task_transitions.py`) and one frontend state (`TaskCard.vue`'s disabled-Advance-on-done) were each deliberately broken and confirmed to produce the correct, isolated test failure, then restored and confirmed to pass again.
- Real, disclosed test-suite gap and its fix: `backend/tests/test_health.py`'s readiness tests all used `app.dependency_overrides` and never exercised the real `get_database_ready()` body - this is exactly how the Module 18 drill code shipped to `main` undetected. Fixed this module: `test_ready_health_uses_real_dependency_without_override`.

## Environment and configuration inventory

- `.env.example` - every local environment variable, with real defaults.
- [VERSION_MATRIX.md](../VERSION_MATRIX.md) - pinned tool/runtime versions.
- [docs/architecture.md](architecture.md) - configuration boundaries table (local Compose env vs. production Secret Manager; browser vs. server-side API base).

## Deployment, migration, and rollback runbooks

- [docs/deployment.md](deployment.md).
- [docs/operating-runbook.md](operating-runbook.md) - first-response steps, correlating logs by request ID/revision.
- `infrastructure/gcp/scripts/rollback.sh` - real, executed, independently verified this course (Module 18: real Cloud Run traffic rollback, confirmed via direct `curl` and `gcloud run services describe`).
- Real, current caveat this module surfaced: a Cloud Run *traffic* rollback does not revert source code - Module 18's drill code stayed on `main` until this module's own fix (`225e065`). Application-level rollback is not automatically schema-safe either (see Module 18's incident review and this module's Step 6 database-compatibility analysis for why).

## Security model and known limitations

- [docs/security.md](security.md).
- Real, verified controls: Argon2id password hashing (confirmed at the database row level this module, not just code inspection); resource-scoped `404` (not `403`) on cross-user access attempts, verified by real tests; OIDC/Workload Identity Federation for deployment (no long-lived service-account key anywhere in the repo or its git history, confirmed by a full-history pickaxe search).
- Known, real, disclosed limitations: see the risk register below - refresh-token rotation is design-only, no rate limiting on login, cross-origin cookie/session topology unresolved.

## Cloud cost and cleanup

- [docs/cost-control.md](cost-control.md).
- Real, executed teardown evidence: Module 18's full `terraform destroy` (34 resources, real verification from multiple independent angles - `terraform state list`, `gcloud sql/run/secrets/artifacts list`, real `404`s from Google's edge on the old service URLs).

## Incidents

- [docs/incidents/2026-08-25-module18-health-ready-drill.md](incidents/2026-08-25-module18-health-ready-drill.md) - the Module 18 drill incident review.
- Real, current, closely-related follow-up: this module (19) found and fixed a genuine consequence of that same incident - the drill's *code* was never reverted, only production traffic. See `learner/LEARNING_LOG-elio-kassab.md`'s Module 19 entry for the full real investigation.

## Open risk register

See `learner/LEARNING_LOG-elio-kassab.md`'s Module 19 entry, "Step 5 - real risk register" - a real, honestly-prioritized list grounded in gaps this course's own logs already disclosed, each with owner, next evidence, and whether it blocks real users.
