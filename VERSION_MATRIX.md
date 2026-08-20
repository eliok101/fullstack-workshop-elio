# Reference version matrix

Reviewed: **2026-07-22**

Versions are deliberately bounded or pinned so the workshop is reproducible. They are not promises of perpetual currency. Revalidate before each cohort and update code, CI, Docker images, exercises, and references together.

| Area | Reference | Repository location | Policy |
|---|---|---|---|
| Python | 3.13 | `backend/Dockerfile`, CI, `pyproject.toml` | Supported minor; retest before changing |
| FastAPI | 0.139.2 | `backend/pyproject.toml` | Pinned |
| SQLAlchemy | 2.0.51 | `backend/pyproject.toml` | Pinned |
| Alembic | 1.18.5 | `backend/pyproject.toml` | Pinned |
| Pydantic Settings | 2.14.2 | `backend/pyproject.toml` | Pinned |
| Psycopg | 3.3.4 | `backend/pyproject.toml` | Pinned |
| PyJWT | 2.13.0 | `backend/pyproject.toml` | Pinned |
| Uvicorn | 0.51.0 | `backend/pyproject.toml` | Pinned |
| PostgreSQL | 17 | Compose and Terraform | Same major locally and in Cloud SQL |
| Node.js | 22 LTS line | Dockerfiles and CI | LTS line, not `latest` |
| Nuxt | 4.4.8 | `frontend/package.json` | Pinned |
| Vue | 3.5 compatible | `frontend/package.json` | Compatible range |
| Vitest | 3.2.7 | `frontend/package.json` | Compatible range; lock before cohort |
| Playwright | 1.61.1 | `e2e/package.json`, Dockerfile | Package and browser image must match |
| Terraform Google provider | 7.40.x | `infrastructure/gcp/terraform/versions.tf` | `>=7.40,<8`; commit lockfile after init |
| Terraform Random provider | 3.9.x | Terraform versions | `>=3.9,<4` |
| GitHub checkout | v7 | workflows | Major tag; consider commit-SHA pinning by policy |
| GitHub setup-python | v7 | workflows | Major tag |
| GitHub setup-node | v6 | workflows | Major tag |
| Google auth action | v3 | deployment workflow | OIDC only; no key JSON |
| Google setup-gcloud | v3 | deployment workflow | Major tag |
| Docker setup-buildx | v4 | CI | Major tag |
| Docker build-push | v7 | CI | Major tag |
| Upload artifact | v7 | CI | Major tag |
| dorny/paths-filter | v3 | CI | Major tag; third-party (not a `github-actions`/`docker`/`google-github-actions` org action) - reviewed before pinning |

## Lockfile policy

The ZIP intentionally remains source-readable and uses `npm install` in its baseline Dockerfiles because package resolution was not performed in the artifact assembly environment. Before the first cohort, maintainers should run the following on a trusted connected machine and commit the generated lockfiles:

```bash
cd frontend && npm install
cd ../e2e && npm install
cd ../infrastructure/gcp/terraform && terraform init
```

After lockfiles are committed:

- change Docker and CI installs from `npm install` to `npm ci`;
- preserve the exact Playwright package/browser-image match;
- review transitive changes and generated advisories;
- run the complete local and cloud validation path.

Do not update a framework only because a newer number exists. Open a maintenance PR that includes release-note review, dependency diff, full tests, image rebuilds, migration validation, and curriculum screenshots/commands where affected.
