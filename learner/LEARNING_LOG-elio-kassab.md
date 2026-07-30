# Learning log

Create a personal copy. Update it at least once per work session and before every pull request.

## Learner

- Name: Elio Kassab
- Cohort: N/A
- Start date: 2026-07-29
- Mentor: N/A
- Primary operating system: Windows 11 Pro
- Prior backend experience: None
- Prior frontend experience: None
- Prior Docker/cloud experience: None

---

## Entries

### Baseline — Environment setup and starter verification

**Date and branch**

- Date: 2026-07-29
- Branch: main
- Pull request: none yet (pre-module-00 baseline)

**Objectives in my own words**

Prove the workstation, Docker network, FastAPI process, Nuxt process, and PostgreSQL connection work before starting numbered module work, per the baseline definition of done in `STARTER_SCOPE.md`.

**Work completed**

- Created `.env` from `.env.example`.
- Ran `./scripts/setup.sh`; verified git, Docker, and Docker Compose are present and usable.
- Ran `docker compose up --build`; hit a real, reproducible frontend image build failure (see Failure investigated).
- Fixed `frontend/Dockerfile` to copy `package-lock.json` and install via `npm ci` with npm pinned to `11.18.0`.
- Fixed a separate, pre-existing frontend typecheck failure by adding `@types/node` to `frontend/package.json` (and regenerated `frontend/package-lock.json`).
- Rebuilt both images from scratch (`--no-cache`) and brought the full stack up; verified backend and frontend health.
- Ran the equivalent of `make test` (backend pytest + frontend typecheck) and `make validate`, including a fresh `git clone` check to rule out false positives from local generated artifacts.
- AI assistance: Claude Code diagnosed the npm build failure, proposed the Dockerfile/package.json diffs (reviewed before applying), and verified each fix by rebuilding images and rerunning test suites.

**Commands and evidence**

```text
$ cp .env.example .env

$ ./scripts/setup.sh
git:     git version 2.55.0.windows.1
docker:  Docker version 29.6.1, build 8900f1d
compose: Docker Compose version v5.3.0
Starter prerequisites are ready. Run: docker compose up --build

$ docker compose up --build
...
#23 [frontend dependencies 4/4] RUN npm install --no-audit --no-fund
#23 118.6 npm error Cannot read properties of null (reading 'edgesOut')
#23 ERROR: process "/bin/sh -c npm install --no-audit --no-fund" did not complete successfully: exit code: 1
target frontend: failed to solve: ... exit code: 1
(backend target built successfully; only frontend failed)

# after Dockerfile + package.json fixes and a clean rebuild:
$ docker compose up --build -d
...
 Container fullstack-intern-starter-db-1 Healthy
 Container fullstack-intern-starter-backend-1 Healthy
 Container fullstack-intern-starter-frontend-1 Started

$ curl -s http://localhost:8000/health/live
{"status":"alive"}
$ curl -s http://localhost:8000/health/ready
{"status":"ready"}
$ curl -s http://localhost:3000/api/health
{"status":"ready"}
$ curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
200

$ docker compose run --rm backend pytest
1 passed, 1 warning in 1.74s

$ docker compose run --rm frontend npm run typecheck
[Vue] Resolve plugin path failed: vue-router/volar/sfc-route-blocks ...   # non-fatal console.warn
EXIT CODE: 0

$ python3 scripts/validate-starter.py .        # run in this working tree
Starter validation failed:
 - Generated directory must not ship: backend\.pytest_cache
 - Generated directory must not ship: frontend\.nuxt
 - Generated directory must not ship: frontend\node_modules
 - Generated or secret file must not ship: .env
# all four are gitignored, locally generated artifacts; confirmed untracked via `git status`

$ git clone . <scratch-dir> && python3 <scratch-dir>/scripts/validate-starter.py <scratch-dir>
Starter structure, module sequence, JSON/TOML, local Markdown links, and release hygiene are valid.
EXIT CODE: 0
```

**Failure investigated**

- Symptom: `docker compose up --build` failed while building the `frontend` image at `RUN npm install --no-audit --no-fund`, with `npm error Cannot read properties of null (reading 'edgesOut')`.
- Smallest reproduction: `docker compose build frontend --no-cache`, reproduced deterministically on two separate attempts (not a network flake). `docker compose build backend` succeeded independently, isolating the fault to the frontend/npm path.
- Hypothesis: a known bug in npm's `arborist` dependency resolver (`#loadPeerSet` in `build-ideal-tree`, see npm/cli issues #8261 and #9787) triggered by a full registry re-resolution.
- Evidence that confirmed it: `frontend/Dockerfile` only did `COPY package.json ./` — it never copied `frontend/package-lock.json` into the build context, so every build forced `npm install` to compute a fresh dependency/peer graph from the registry instead of reifying the already-resolved lockfile. That matches the exact code path (`build-ideal-tree` peer-set resolution) implicated in the npm bug reports. `VALIDATION_REPORT.md` independently discloses the export environment had no working npm registry access, so this Docker build path had never actually been exercised before.
- Root cause: missing lockfile in the Docker build context forced a full npm dependency resolution on every build, hitting a null-dereference bug in npm's peer-dependency resolver.
- Prevention or test added: `frontend/Dockerfile` now copies `package-lock.json` and installs via `npm ci` (reifies from the lock instead of re-resolving), with npm pinned to a version (`11.18.0`) confirmed compatible with the pinned `node:22.16.0-alpine` base image. `npm@12.0.1` was tried first (it's what the container itself suggested) but rejected — it requires Node ≥22.22.2, incompatible with this base image. Verified reproducibility by rebuilding with `--no-cache` twice after the fix.

**Decision and tradeoff**

Fixed the build by pinning npm and switching to `npm ci` from the committed lockfile, rather than changing the pinned application dependency versions (`nuxt`, `vue-router`, etc.) that the course curriculum specifies. This keeps the dependency versions the workshop modules were written against intact, at the cost of an extra `RUN npm install -g npm@11.18.0` layer that will need revisiting if a future Node base-image bump changes which npm versions are compatible.

**Security, privacy, and operations**

`.env` only contains local-only default Postgres credentials (`workboard-local-only`), is gitignored, and is not committed (confirmed via `git status`). No secrets were introduced. The production Docker stage only copies the built `.output` directory, not `node_modules` or dev dependencies, so pinning npm and using `npm ci` in the `dependencies` build stage has no runtime/production image impact.

**Review feedback**

N/A — no pull request opened yet for this baseline work.

**Remaining uncertainty**

The `[Vue] Resolve plugin path failed: vue-router/volar/sfc-route-blocks` warning during typecheck (a mismatch between `vue-router@4.6.4`'s exports map and what `@vue/language-core@3.2.5` expects) is non-fatal today, confirmed by exit code 0, but I haven't confirmed whether a future `vue-router`/`vue-tsc` patch resolves it cleanly or whether it should be pinned/addressed explicitly before relying on IDE-level Vue Volar tooling.

**Self-rating**

- I can repeat this with notes: yes
- I can explain it without the reference code: not yet
- I can diagnose one failure in this area: maybe
- Confidence from 1–5: 2

---

### Module 00 — Architecture sketch and boundary explanations

**Date and branch**

- Date: 2026-07-30
- Branch: learning/00-orientation
- Pull request: none yet

**Evidence type**

Module 00 step 1 ("draw the system from memory using five boxes: browser, Nuxt, FastAPI, PostgreSQL, Google Cloud delivery. Add arrows and state what travels over each boundary.") — required evidence item "architecture sketch with boundary explanations."

**Sketch (drawn from memory, then corrected against `docs/architecture.md`)**

```text
[Browser] --HTTPS--> [Nuxt :3000] --REST/JSON--> [FastAPI :8000] --SQL--> [PostgreSQL :5432]
                                                        |
                                              [Google Cloud delivery]
                                     (GitHub Actions --OIDC--> Artifact Registry,
                                      Cloud Run, Cloud SQL, Secret Manager)
```

**Boundary explanations**

- Browser → Nuxt (`:3000`, HTTPS): the browser's only network target; carries page requests and rendered HTML/hydration payloads.
- Nuxt → FastAPI (`:8000`, REST/JSON): server-side Nuxt calls the backend over Docker DNS (`backend:8000`) locally, or the deployed API's Cloud Run URL in production; client-side calls hit the public API base. Carries JSON bodies and a Bearer token for authenticated routes.
- FastAPI → PostgreSQL (`:5432`, SQL): carries SQL statements over a pooled connector; this is the only boundary that touches durable state.
- **Correction from my first draft:** I originally drew Google Cloud delivery as a single branch hanging off FastAPI. Per the system context diagram in `docs/architecture.md`, that's not accurate — GitHub Actions authenticates to GCP via OIDC (no stored key JSON), pushes images to Artifact Registry, and from there **both** Cloud Run services deploy independently (`workboard-web` for Nuxt and `workboard-api` for FastAPI), alongside Cloud SQL being provisioned separately. It's a fan-out to all three runtime pieces, not a single downstream branch off the backend.
- Secret Manager → FastAPI: database URL and signing key are injected into the backend at runtime (via Cloud Run environment), never baked into the image or passed as Docker build arguments.
- Cloud Logging/Monitoring → Engineer: the observability feedback loop back to whoever is operating the system — not covered until Module 18, but it's the fifth real boundary in the full diagram.

**Source verified against:** `docs/architecture.md` § System context (mermaid `flowchart LR`).

**Definition-of-done evidence table**

| Claim | How it's proven |
|---|---|
| A clean machine can run the application | git clone → make setup → make up → make ps shows db/backend/frontend all healthy |
| A user cannot read another user's private project | Automated test: authenticated request for another user's private project returns 403/404 |
| A database schema can be reproduced from zero | Run migrations against empty DB, confirm current revision matches expected via migration tool output |
| Public project content exists in initial HTML | curl the public project page, grep response body for project content — before any client JS executes |
| A failed pull request cannot merge | Push a commit that fails a required CI check, show GitHub blocks merge |
| A known-good cloud revision can receive traffic again | Deploy a bad revision, shift Cloud Run traffic to the prior revision, confirm smoke check passes |

**Work agreement (Step 4)**

No mentor assigned for this self-paced run of the workshop; core hours, PR rules, AI-use policy, reference-access policy, cloud billing owner, and escalation path are not yet established. Will revisit if a mentor is assigned.

**Baseline explanation (Step 5, answered without opening source files)**

1. Why frontend and backend are separate production services: they scale, deploy, and fail independently — a frontend issue shouldn't take down the API and vice versa.
2. Why PostgreSQL data is not stored in a container filesystem: containers are ephemeral and get destroyed/replaced; a named volume (or Cloud SQL in production) persists independently of container lifecycle.
3. Why a migration job is different from application startup: migrations change schema and must run once, deliberately, not on every app boot — concurrent/multiple instances starting at once could cause conflicting schema changes.
4. Why one green browser path is insufficient: it only proves one flow under one condition — not authorization boundaries, error states, or degraded-dependency behavior.
5. Why rollback may fail after an incompatible database migration: if new code depends on a schema change, rolling back the code alone doesn't undo the schema — old code can break against the new schema.

Uncertainty: none flagged — I feel confident on all five after discussion, though I'd want to actually see the failure-mode behaviors in modules 04-09 to confirm this holds up in practice, not just in explanation.

**Independent challenge — miniature definition-of-done for "delete a project"**

1. API contract: DELETE /api/projects/{project_id}. Success: 204 No Content. Failure: 401 (not authenticated), 403 (not the owner), 404 (project doesn't exist), 500 (server error).

2. Authorization: only the project owner can delete it. Backend checks the user is authenticated and that the user's ID matches the project's owner. (Note: this app doesn't have an admin role per docs/architecture.md's deliberate omissions, so admin override is a future extension, not part of base scope.)

3. Persistence: soft delete via a deleted_at column rather than hard delete, so projects are recoverable. Tasks belonging to the project are hidden/marked deleted alongside it.

4. Migration impact: yes if soft delete is used — a migration adds `deleted_at TIMESTAMP NULL` to the projects table. No schema change needed if hard delete were used instead.

5. Frontend states: confirmation dialog before deleting; loading spinner and disabled delete button during the request; success message + redirect to the projects list after; error message with the project still visible if deletion fails.

6. Tests: create a project, send DELETE, assert 204, assert the project no longer appears in the project list.

7. Logs: project ID, user ID, username, timestamp, result (success/failed). Example: "User 15 deleted Project 42 at 2026-07-30 09:45 UTC."

8. Rollback: disable via feature flag or redeploy the previous app version; soft-deleted projects can be restored from the database if the feature caused unwanted deletions.

**Self-rating**

- I can repeat this with notes: 5/5
- I can explain it without the reference code: 4/5
- I can diagnose one failure in this area: 4/5
- Confidence from 1–5: 4

---

### Module 01 — Workstation and repository setup

**Date and branch**

- Date: 2026-07-30
- Branch: learning/01-setup
- Pull request: none yet

**Objectives in my own words**

Verify the local toolchain with exact version evidence, confirm `.env` stays untracked and understand why `.gitignore` and `.dockerignore` solve different problems, start the stack and interpret health/liveness vs readiness, and diagnose a deliberate database failure.

**Work completed so far**

- Verified tool versions: git 2.55.0, Docker 29.6.1, Docker Compose v5.3.0, running on Windows 10.0.26200 via Git Bash/MSYS.
- Confirmed `gcloud`, `terraform`, and `gh` are not installed yet — not needed until modules 16-17, noted as a workstation gap to close later.
- Checked `docker info` for resource usage (images, containers, volumes, build cache).
- Confirmed `git status` clean, remote correctly set to `eliok101/fullstack-workshop-elio`, and `.env` confirmed ignored via `git check-ignore -v .env` (matched at `.gitignore:1`).
- Reviewed `.gitignore`, `.dockerignore` (root, and noted it's per-service in practice via `backend/.dockerignore` and `frontend/.dockerignore`), and `.env.example`.

**`.gitignore` vs `.dockerignore` explanation**

Although .gitignore and .dockerignore may exclude some of the same files, they serve different purposes.

.gitignore tells Git which files and folders should not be tracked or committed to the repository. This keeps the project history clean by excluding generated files, dependencies, caches, and sensitive information such as .env files. For example, node_modules/, .pytest_cache/, coverage/, and .env are excluded because they are either large, automatically generated, or contain secrets.

.dockerignore tells Docker which files should not be sent to the Docker build context when creating an image. This reduces build time, keeps images smaller, and prevents unnecessary or sensitive files from being included in image layers. For example, .git/ is excluded because the project's Git history is not needed inside the container, and .env is excluded to prevent local secrets from being copied into the image.

Some files, such as .env and node_modules/, appear in both files, but for different reasons. Git ignores them to keep the repository clean and secure, while Docker ignores them to improve build performance and avoid including unnecessary or sensitive files in the container image.

A file being ignored by Git does not mean Docker will ignore it, and a file ignored by Docker does not mean Git will ignore it. Each file only affects its own tool, which is why important files like .env should be listed in both .gitignore and .dockerignore.

Note there's also a `.dockerignore` per service (`backend/.dockerignore`, `frontend/.dockerignore`) — this root one is separate and would only apply if something built from repo root as its Docker context, which nothing in `compose.yaml` currently does (both `backend` and `frontend` builds use their own subdirectory as context).

**Workstation observation**

Two local clones of this repository existed on this machine: the canonical one at `C:\Users\Elio\fullstack-workshop-elio` (all work happens here) and a stale one under OneDrive at `C:\Users\Elio\OneDrive\Documents\Github\fullstack-workshop-elio` (still on `main`, no fixes applied). The OneDrive copy was a risk for confusion and potential OneDrive-sync conflicts with Docker bind mounts. Before removing it, confirmed via `git fetch` that its one extra commit (`2d930b9 delete the alpine`) was already pushed to `origin/main` and its only untracked content (`.vscode/settings.json`) was empty — nothing unique was lost by deleting it.

**Controlled failure drill — database outage**

Prediction (made before running): stopping only the database would leave `/health/live` returning 200 (no DB dependency), while `/health/ready` would fail, since it verifies real database connectivity.

Evidence:

- `docker compose stop db`
- `curl -i http://localhost:8000/health/live` → `HTTP/1.1 200 OK` `{"status":"alive"}`
- `curl -i http://localhost:8000/health/ready` → `HTTP/1.1 503 Service Unavailable` `{"detail":"database unavailable"}`
- `docker compose start db` → db back to healthy within ~1 minute
- `curl --fail http://localhost:8000/health/ready` → `{"status":"ready"}`, exit 0

Explanation: liveness only confirms the FastAPI process itself is running and responsive, with no dependency on the database — this matches why liveness should not fail during a temporary dependency outage (a process restart wouldn't fix a database outage, so failing liveness here would cause unnecessary, useless container restarts). Readiness performs a live database connection check each time it's called, which is why it failed immediately when the database stopped and recovered automatically the moment the database became healthy again, with no manual backend restart needed — confirming this is a live check, not a cached state.

**Runtime identity check**

- `docker compose exec backend whoami` → `app` (non-root)
- `docker compose exec frontend whoami` → `root`
- `docker compose exec backend python --version` → `Python 3.13.5`
- `docker compose exec frontend node --version` → `v22.16.0`
- Noted: backend dev container already runs non-root, matching production; frontend dev container runs as root, with only its separate production stage switching to non-root. This dev/prod asymmetry is expected per the module's own guidance to defer the production-user proof to Module 04.

**Workstation gap noted**

`make` is not on PATH in this Git Bash session (`make ps` returned "command not found", exit 127); `docker compose` commands used directly as a substitute. Worth resolving before relying on make-based commands in later modules.

**Independent challenge — Postgres port override**

The `db` service originally had no `ports:` block at all — Postgres was only reachable on the internal Compose network at `db:5432`, never exposed to the host.

Steps:

1. Added `ports: ["${POSTGRES_PORT:-5432}:5432"]` to the `db` service in `compose.yaml`.
2. Set `POSTGRES_PORT=5433` in `.env`.
3. Restarted the stack (`docker compose down && docker compose up -d`).
4. `docker compose ps` confirmed `db` now bound to `0.0.0.0:5433->5432/tcp`.
5. `curl --fail http://localhost:8000/health/ready` still returned `{"status":"ready"}`, exit 0.
6. Removed `POSTGRES_PORT` from `.env`, restarted again, confirmed `db` returned to `0.0.0.0:5432->5432/tcp` (via `compose.yaml`'s `${POSTGRES_PORT:-5432}` default fallback) and all services healthy.

Proof: backend's `DATABASE_URL` uses `db:5432` (Docker service DNS name + internal container port), which is completely independent of whatever host port is mapped to reach Postgres from outside Docker. Changing the host-side port (5432 → 5433 → back to 5432) had zero effect on backend-to-database connectivity, since container-to-container traffic on the Compose network never touches the host port mapping at all — that mapping only matters for connections originating from outside Docker (e.g. a local psql client or GUI tool).

**Self-rating**

- I can repeat this with notes: yes - with my notes, I can repeat the module, explain each step, and reproduce the setup and verification process.
- I can explain it without the reference code: yes - liveness checks whether the application is running, readiness checks whether it's ready to serve requests (including dependencies like the database), and port mapping connects a port on the host machine to a port inside the Docker container.
- I can diagnose one failure in this area: mostly yes - I could use Docker commands, container logs, health endpoints, and process of elimination to identify which service is failing, though I might still need documentation for more complex or unfamiliar issues.
- Confidence from 1–5: 4/5 - I understand the concepts and can perform the module independently, but I'd like more practice troubleshooting different failure scenarios before considering myself fully confident.

---

## Module entry template

### Module NN — title

**Date and branch**

- Date:
- Branch:
- Pull request:

**Objectives in my own words**

Explain what capability this module is building and why a production team needs it.

**Work completed**

Describe the behavior, tests, documentation, and operating changes—not merely the filenames.

**Commands and evidence**

```text
Paste the important commands and concise outputs.
```

**Failure investigated**

- Symptom:
- Smallest reproduction:
- Hypothesis:
- Evidence that confirmed or rejected it:
- Root cause:
- Prevention or test added:

**Decision and tradeoff**

State one decision, an alternative, and why the chosen option fits this context.

**Security, privacy, and operations**

What input, authorization, secret, data, log, migration, cost, or rollback concern did this work introduce?

**Review feedback**

What changed because of review? What principle can be reused later?

**Remaining uncertainty**

Write a precise question or topic to revisit.

**Self-rating**

- I can repeat this with notes: yes / not yet
- I can explain it without the reference code: yes / not yet
- I can diagnose one failure in this area: yes / not yet
- Confidence from 1–5:

---

## Weekly synthesis template

### Week N

- Most important capability gained:
- Hardest failure and how it was diagnosed:
- Strongest evidence produced:
- Repeated mistake or risk pattern:
- One concept I can now teach another learner:
- One objective for next week:
