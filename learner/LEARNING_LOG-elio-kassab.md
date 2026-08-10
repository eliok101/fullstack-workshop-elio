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

### Module 02 — Git, GitHub, and pull requests

**Date and branch**

- Date: 2026-08-01
- Branch: learning/02-git-workflow
- Pull request: none yet

**Objectives in my own words**

Use branches, commits, remotes, pull requests, and reviews as a controlled change workflow; write focused commits; resolve a merge conflict; understand required checks and force-push policy.

**Work completed so far**

- Confirmed git identity (fixed a typo in `user.email` from `eliokssab289@gmail.com` to `eliokassab289@gmail.com` — note this only applies going forward, prior commits keep the original address).
- Reviewed `git log`/remote state, discovered the `upstream` remote points to `FadiZahhar/fullstack-workshop-ogilvy` — the instructor's original template this repo was forked from, explaining an earlier mix-up where that repo appeared unexpectedly in a browser tab.
- Created branch `learning/02-git-workflow` from `learning/01-setup`.

**Git state model, in my own words**

- Working tree = the actual files on your machine that you are editing right now.
- Staging area (index) = a "waiting room" where you choose which changes should go into the next commit (using `git add`).
- Local commit = a snapshot of your staged changes, saved in your local Git history (only on your machine, not shared yet).
- Remote branch = the version of your branch that lives on a remote repository (like GitHub). Other people can see it, and you update it using `git push`.

Flow: you edit files (working tree) → you select what to include via `git add` (staging area) → you save a version via `git commit` (local commit) → you share it via `git push` (remote branch).

Practicing selective staging in Step 3.

**Pull request opened**

Draft PR #1 opened: https://github.com/eliok101/fullstack-workshop-elio/pull/1
"Learning/02 git workflow" — learning/02-git-workflow into main, 6 commits.
Note: GitHub's default compare view initially pointed at the wrong base repository (FadiZahhar/fullstack-workshop-ogilvy, the upstream template this repo was forked from) rather than eliok101/fullstack-workshop-elio — caught and corrected before creating the PR by navigating directly.
Note: GitHub reports "Can't automatically merge" against main — a real merge conflict exists, which will be used for this module's Step 6 conflict-resolution exercise instead of manufacturing one.

**Merge conflict resolution — Step 6**

Conflict: rebasing `learning/02-git-workflow` onto `origin/main` hit a real conflict in `frontend/Dockerfile`. `origin/main`'s commit `2d930b9` "delete the alpine" switched the base image from `node:22.16.0-alpine` to `node:22.16.0` (Debian/glibc) and updated `addgroup`/`adduser` flags accordingly (`-S`/`-G` for BusyBox/Alpine → `-r`/`-g` for Debian/glibc). My branch's commit had kept `-alpine` and added a pin (`npm install -g npm@11.18.0`) to fix an earlier npm arborist bug.

Resolution decision: adopted main's base image change (main is the source of truth for project direction) while keeping my npm pin as a safety net rather than assuming the base image switch alone fixed the original bug — a decision to verify empirically rather than assume, and to resolve the conflict first before considering any cleanup/simplification separately.

Verification uncovered a second, deeper problem: `frontend/package-lock.json` auto-merged silently during the rebase (no conflict markers), but its `libc` metadata (glibc vs musl entries for the `oxc-parser` native binding) ended up inconsistent with the new base image. The Docker build itself succeeded (installing packages doesn't validate that native bindings actually load), but the frontend container crash-looped at runtime with `"Cannot find module '@oxc-parser/binding-linux-x64-gnu'"` — because the lockfile still resolved the wrong platform variant.

This is a concrete example of why "the build succeeded" and "the system actually works" are different claims — the build error would never have surfaced without a real `docker compose up` and a runtime health check, not just a Docker image build.

Fix: deleted `frontend/package-lock.json`, regenerated it fresh against the new (Debian/glibc) base image via `docker compose run --rm frontend npm install`, rebuilt `--no-cache`, and re-verified all four endpoints (backend live, backend ready, frontend `/api/health`, frontend homepage) all returned 200 with correct content.

Lesson: a silently auto-merged file (no conflict markers) is not automatically safe just because Git resolved it without complaint — a lockfile's correctness depends on the environment it's regenerated against, and textual merging can produce a file that is syntactically valid but semantically wrong for the new context.

**Independent challenge — git bisect**

Set up a 6-commit practice history on a throwaway branch (`scratch/bisect-practice`, branched off `main`, isolated from real work) where a text assertion (`status: ready`) flips to something else (`status: pending`) partway through and stays broken.

Commands run:

```text
git bisect start
git bisect bad HEAD
git bisect good eba36a2
```

Then, at each checkout, inspected `bisect-scratch.txt` for the status line and reported good/bad based on what was actually there:

- Checkout 1 (`e20580b`, commit 3/6): showed `status: pending` → reported bad
- Checkout 2 (`7da7bfb`, commit 2/6): showed `status: ready` → reported good
- Result: `e20580b` identified as the first bad commit — correct, in 2 checks instead of manually inspecting all 6 commits.

`git bisect reset` used to return to normal branch state afterward.

Lesson: bisect uses binary search, not linear scanning — with 6 commits it took 2 checks to isolate the exact point of breakage, and the number of checks needed grows logarithmically (not linearly) with history size, which matters a lot on a real project history with hundreds or thousands of commits.

**Self-rating**

- I can repeat this with notes: 4/5 - understand branching, selective staging, opening a PR, resolving merge conflicts by intent (not just picking a side), and the git bisect workflow. Would likely glance at the exact bisect command sequence if not used recently.
- I can explain it without the reference code: 5/5 - comfortable explaining the Git state model (working tree → staging area → local commit → remote branch), why merge conflicts happen, how to inspect both sides, and why resolving first then refactoring separately matters.
- I can diagnose one failure in this area: 4/5 - confident working through a similar merge conflict independently by reading both versions and testing the result. For bisect, understand the workflow and could perform one, possibly double-checking exact command syntax.
- Confidence from 1–5: 4/5 - this module was more conceptually demanding than Modules 00/01 since it required understanding Git's mental model, not just running commands. Bisect is the area needing the most additional hands-on repetition, simply due to lower frequency of use compared to branching/staging/conflict resolution.

**Review and merge**

Step 5 (read checks and review comments) and formal review in Step 8: no CI checks are currently configured on this repo to inspect, and no mentor was assigned to formally review this PR — same gap noted in Module 00's work agreement section. PR #1 was self-reviewed against the validation checklist, converted from draft, and merged directly as the repo owner. Merge confirmed clean with no conflicts against main.

(This final note itself was pushed directly to main rather than through another PR, since it's a trivial reflective addition - a reasonable exception in most workflows, though worth flagging as not strictly following this module's own branch-per-change practice.)

---

### Module 03 — HTTP, REST, JSON, and API contracts

**Date and branch**

- Date: 2026-08-03
- Branch: learning/03-api-contracts
- Pull request: none yet

**Objectives in my own words**

Decompose HTTP requests/responses into their components, choose status codes based on semantics, exercise the API manually, and build an error matrix distinguishing 401/403/404/409/422.

**Work completed so far**

Step 1: attempted `curl --fail http://localhost:8000/openapi.json` and `GET /api/v1/status` — both returned 404, confirming the backend currently only exposes `/health/live` and `/health/ready`. No API contract exists yet; this is the expected starting state per `STARTER_SCOPE.md`, not a bug — "completed API contracts" are exactly what this module and the ones following it build.

Step 2 — traced a real request/response with `curl -v` against `/health/live`:

```text
* Host localhost:8000 was resolved.
* IPv6: ::1
* IPv4: 127.0.0.1
*   Trying [::1]:8000...
* Established connection to localhost (::1 port 8000) from ::1 port 57068
* using HTTP/1.x
> GET /health/live HTTP/1.1
> Host: localhost:8000
> User-Agent: curl/8.21.0
> Accept: */*
>
* Request completely sent off
< HTTP/1.1 200 OK
< date: Mon, 03 Aug 2026 13:38:04 GMT
< server: uvicorn
< content-length: 18
< content-type: application/json
<
* Connection #0 to host localhost:8000 left intact
{"status":"alive"}
```

Transport-level lines (about the TCP connection, not HTTP semantics): host resolution, IPv6/IPv4 addresses tried, connection establishment, "Request completely sent off", "Connection left intact".

Application-level lines (actual HTTP semantics): the request line (`GET /health/live HTTP/1.1`), request headers (`Host`, `User-Agent`, `Accept`), the status line (`HTTP/1.1 200 OK`), response headers (`date`, `server`, `content-length`, `content-type`), and the response body (`{"status":"alive"}`).

Noise (curl's own UI, not HTTP): the percentage progress-meter rows and the `{ [18 bytes data] }` placeholder line.

Note: curl resolved both IPv6 (`::1`) and IPv4 (`127.0.0.1`) for `localhost` but connected over IPv6 first, successfully — worth being precise about which protocol was actually used rather than assuming IPv4 by default.

Note: no CORS or security-related headers (`Content-Security-Policy`, `Access-Control-Allow-Origin`) are present, which is expected for a same-origin health check with no cross-origin or auth concerns at this stage.

Step 3 - attempted to exercise authentication manually:

- `curl -i -X POST http://localhost:8000/api/v1/auth/register` (with a valid registration body) → `404 Not Found`, `{"detail":"Not Found"}`
- `curl -i -X POST http://localhost:8000/api/v1/auth/login` (with valid form-encoded credentials) → `404 Not Found`, `{"detail":"Not Found"}`

Both expected: `STARTER_SCOPE.md` explicitly lists authentication/JWT implementation as deliberately absent from the starter (built in Module 08). Since no token can be obtained, Steps 3 onward that require authentication (exercising `/auth/me`, creating projects/tasks, the cross-user privacy independent challenge) cannot be executed against real endpoints yet.

Important distinction for the error matrix (Step 4): this 404 is produced by FastAPI/Starlette's routing layer itself (no matching route exists at all), which is a different case from a resource-scoped 404 an application handler would deliberately return (e.g. "this project exists but isn't yours to see"). Same status code, different origin and meaning — worth capturing this distinction explicitly in the matrix rather than treating all 404s as equivalent.

**Step 4 - Status/error matrix**

Scenario A: Project creation (POST /api/v1/projects)

| Condition | Status | Reasoning |
|---|---|---|
| Valid request | 201 | Successful creation |
| Missing required field | 422 | FastAPI validation error, not a generic 400 |
| Malformed type/enum | 422 | Same validation layer as missing fields |
| No token | 401 | Not authenticated |
| Invalid/expired token | 401 | Same as no token - authentication problem, not authorization |
| Duplicate project name/slug | 409 | Conflict with existing state |

Scenario B: Task status transition (PATCH /api/v1/projects/{id}/tasks/{id})

| Condition | Status | Reasoning |
|---|---|---|
| Valid transition | 200 | Successful update, not a new resource so not 201 |
| Invalid transition (e.g. backlog to done) | 409 | Conflict with current resource state, stable code "invalid_transition" per api-contract.md |
| No token | 401 | Not authenticated |
| Project/task doesn't exist | 404 | Genuinely missing resource |
| Project exists but not accessible to this user | 404 (resource-scoped), not 403 | Corrected from my first attempt - api-contract.md explicitly prefers a resource-scoped 404 over 403 here to avoid confirming a private project's existence to an unauthorized user. This is the exact behavior the Step 7 independent challenge (cross-user privacy) will verify empirically. |
| Malformed status value (e.g. "in-progress" with hyphen) | 422 | Validation error |

Self-correction note: initially answered 403 for "project exists but not accessible" - the actual contract prefers 404 specifically to prevent leaking whether a private resource exists at all to someone who shouldn't have access. This is one of the most important security-by-design lessons in this module.

**Step 5 - Idempotency and retry implications**

| Operation | Idempotent? | Reasoning |
|---|---|---|
| GET /projects (repeated) | Yes | Read-only, also a "safe" method - no state change at all |
| POST /projects (repeated, same body) | No | Each call can create a new project - repeating is dangerous, not just redundant |
| PATCH /tasks/{id} (repeated, same body) | Yes, for this specific case | Setting a field to an explicit absolute value (e.g. status: "in_progress") gives the same end state no matter how many times it's repeated. Note PATCH is not idempotent by the HTTP spec in general (e.g. "increment by 1" via PATCH would not be) - this is about this specific update pattern, not a blanket property of PATCH. |
| DELETE /tasks/{id} (repeated after deletion) | Yes | The resource ends up in the same state (gone) regardless of repeat count, even though the response status code may differ between calls (e.g. 204 then 404) - idempotency is about resource state, not identical responses. |

Practical retry implication: a client can safely auto-retry GET, PATCH (of this kind), and DELETE after a network failure without worrying about side effects, but should not blindly auto-retry POST - a lost response after a successful POST could result in duplicate resource creation on retry. This is why some production APIs (e.g. payment systems) use a client-generated idempotency key even for POST, letting the server recognize and deduplicate a retried request that isn't naturally idempotent by method alone.

**Step 6 - Task filtering contract proposal**

Proposed endpoint: `GET /api/v1/projects/{project_id}/tasks?status=in_progress&priority=high`

1. Parameter validation: `status` and `priority` are enum-like fields. An invalid value (e.g. `?status=invalid_value`) should return `422 Unprocessable Content`, rejected at validation before reaching business logic.

2. Combination behavior: multiple filters combine with AND logic (narrowing results), not OR - consistent with typical filter-UI conventions. OR-style matching (e.g. multiple statuses at once) would need an explicit different syntax, such as a comma-separated value.

3. Empty result: a valid query that matches no tasks returns `200 OK` with an empty list (`[]`), not an error - "no results" is a normal successful outcome, not a failure.

4. Pagination (future-proofing): reserve `limit` and `offset` (or `page`/`page_size`) query parameters for future use, with sensible defaults (e.g. `limit=50`) so existing clients calling the endpoint without these params remain unaffected - required for backward compatibility.

5. Index implications: add a database index on `status` and `priority` individually, or a composite index on `(status, priority)` if both are commonly filtered together. Composite index column order should match the most common query pattern, since a `(status, priority)` index speeds up status-only or status+priority queries efficiently, but not priority-only queries.

6. Required updates when adding this: OpenAPI documentation (new query parameters appear in the docs), frontend TypeScript types/API client, and tests covering: valid filter combinations, invalid enum values (expecting 422), multiple filters together (AND behavior), empty results (200 with []), and existing/pre-filter tests to confirm backward compatibility is preserved.

**Step 7 - Independent challenge (cross-user private project access)**

Blocked: this challenge requires creating two real user accounts, authenticating as each, and making direct API calls to prove a private project owned by user A cannot be read by user B. Since `/api/v1/auth/register` and `/api/v1/auth/login` return 404 (confirmed in Step 3 - authentication is deliberately absent from the starter per `STARTER_SCOPE.md`, built in Module 08), no real token can currently be obtained, so this cannot be executed against the live API yet.

Documented expected behavior instead (to verify empirically once Module 08 is complete):

1. Create user A, create a private project as user A (`is_public: false`) → 201.
2. Create user B, authenticate as user B.
3. As user B, `GET /api/v1/projects/{project_id}` for user A's private project.
4. Expected: `404 Not Found` (resource-scoped), not `403` - per the Step 4 matrix decision, this avoids confirming to user B that the private project exists at all.

**Self-rating**

- I can repeat this with notes: yes - can trace requests, apply HTTP status code semantics (200/201/401/403/404/409/422), build an error matrix by systematically asking about success/validation/auth/authorization/existence/conflict for each endpoint, reason about idempotency, and design a new filtered endpoint with pagination, indexing, and doc/test implications in mind.
- I can explain it without the reference code: yes - can explain what each status code communicates, and specifically the resource-scoped 404 pattern (returning 404 instead of 403 for inaccessible-but-existing resources, to avoid confirming their existence to unauthorized users).
- I can diagnose one failure in this area: yes, with moderate confidence - comfortable choosing status codes, building error matrices, reasoning about idempotency, and designing filter/pagination behavior. Would still want to verify project-specific conventions for more advanced security, caching, or concurrency decisions.
- Confidence from 1–5: 4/5 - solid grasp of general HTTP/API design concepts; the main ongoing area for reinforcement is remembering project-specific conventions (e.g. this project's use of 422 for validation, and when it prefers resource-scoped 404 over 403) rather than the underlying concepts themselves.

---

### Module 04 — Docker and container fundamentals

**Date and branch**

- Date: 2026-08-04
- Branch: learning/04-docker-fundamentals
- Pull request: none yet

**Objectives in my own words**

Understand images, layers, containers, and build context; build and inspect multi-stage production images; confirm non-root runtime identity; diagnose build/runtime failures through deliberate drills.

**Work completed so far**

Step 1 - read all three Dockerfiles stage by stage:

`backend/Dockerfile` (3 stages):

- `base`: sets Python env vars (`PYTHONDONTWRITEBYTECODE`, `PYTHONUNBUFFERED`), creates a non-root `app` user/group - shared foundation, nothing runs here.
- `development`: copies full repo (owned by `app`), installs the package in editable mode (`pip install -e '.[dev]'`) which also pulls dev-only dependencies (test/lint tools) and reflects code changes immediately without reinstalling - matches `--reload`. Runs as `app`.
- `production`: copies full repo, installs as a fixed, non-editable install (`pip install .`) for stable/predictable deploys, runs as `app`, adds a real `HEALTHCHECK` instruction and `--proxy-headers` (to trust Cloud Run's `X-Forwarded-*` headers), drops `--reload`.

`frontend/Dockerfile` (4 stages):

- `dependencies`: pins npm and installs from the committed lockfile (the fix from Module 00/02's Docker/npm bug).
- `development`: builds on `dependencies`, copies full source, runs `npm run dev`.
- `build`: also builds on `dependencies`, copies source, compiles via `npm run build`.
- `production`: starts completely fresh from `node:22.16.0` rather than continuing from `dependencies` or `build`, and only copies the compiled `.output` directory from `build`. This keeps build tools, dev dependencies, and source code out of the final image entirely - smaller, more secure, and matches `security.md`'s explicit requirement that "build dependencies are not copied into final frontend image." Creates its own non-root user, runs `node server/index.mjs` directly with no npm involved.

`e2e/Dockerfile`: does not exist yet. Confirmed this is expected - per `STARTER_SCOPE.md`/`COURSE_MAP.md`, the Playwright E2E service is built in Module 15, not present in the starter.

Observation: an asymmetry exists between the two production images - backend's production stage has an explicit image-level `HEALTHCHECK` instruction, but frontend's does not; frontend's health checking currently only happens at the Compose level (`healthcheck:` in `compose.yaml`), not baked into the image itself. Flagging this as worth addressing, possibly as part of this module's evidence.

**Step 2 - build production images directly and inspect**

`docker build --target production -t workboard-backend:module04 backend` → succeeded on first attempt.

`docker build --target production -t workboard-frontend:module04 frontend` → failed on first attempt with a genuine, previously undetected bug:

```text
RUN addgroup -r app && adduser -r app -g app
Unknown option: r
```

Root cause: Debian's `adduser`/`addgroup` (the friendly wrapper scripts) never supported a `-r` flag - not on Debian, and not on the old Alpine/BusyBox image either (which used `-S` for "system", a different convention entirely). Whoever wrote the "delete the alpine" commit (Module 02) swapped Alpine's `-S`/`-G` for `-r`/`-g`, assuming it was the Debian equivalent - but picked the wrong tool's flag convention. The correct low-level equivalent, `--system`, is exactly what `backend/Dockerfile` already uses correctly via `useradd`/`groupadd`.

Why this went undetected until now: `compose.yaml`'s `frontend` service only builds `target: development`, and BuildKit only builds stages required to reach the requested target - the `production` stage's `RUN addgroup` line had never actually executed in this entire project, not during any earlier `docker compose build frontend` run, not during the Module 02 merge-conflict verification. This is the first time `production` was built directly, and it broke immediately. Same underlying lesson as the Module 02 lockfile/glibc bug: passing one build path does not mean every path is correct.

Fix applied: changed to `addgroup --system app && adduser --system --ingroup app app`, matching the working `backend/Dockerfile` pattern. Rebuild succeeded.

Image size comparison:

| Image | Disk usage | Content size |
|---|---|---|
| workboard-backend:module04 | 298MB | 69.9MB |
| workboard-frontend:module04 | 1.61GB | 407MB |

Second finding: frontend's production image is over 5x larger than backend's, but not because the multi-stage pattern failed - the actual `COPY --chown=app:app /workspace/.output ./` layer is only 3.66MB, confirming `security.md`'s "build dependencies are not copied into final frontend image" requirement genuinely holds (no `node_modules`, no build toolchain, no source in the final image). The bloat comes entirely from the base image itself: `node:22.16.0` (full Debian, not a `-slim` or `-alpine` variant) contributes over 1.1GB of apt/build-essential/yarn/gnupg layers before any application code is added, versus backend's `python:3.13.5-slim` base.

Follow-up worth raising: switching the production stage's base to `node:22.16.0-slim` (still Debian/glibc, avoiding whatever motivated dropping Alpine in the first place, but far smaller) would likely recover most of this size difference without reintroducing the original Alpine/musl-related bug from Module 02. Not fixed as part of this module - flagged as a discovered opportunity, not implemented, since Module 04's lab step doesn't ask for base image optimization and this deserves its own reviewed change.

**Step 3 - prove runtime identity**

`docker run --rm --entrypoint whoami workboard-backend:module04` → `app`
`docker run --rm --entrypoint id workboard-backend:module04` → `uid=999(app) gid=999(app) groups=999(app)`
`docker run --rm --entrypoint whoami workboard-frontend:module04` → `app`
`docker run --rm --entrypoint id workboard-frontend:module04` → `uid=100(app) gid=102(app) groups=102(app)`

Both confirmed non-root, matching the security model's "production images run as non-root users" requirement.

Note: UID/GID values differ between images (999/999 backend vs. 100/102 frontend) because `useradd`/`groupadd --system` (backend, shadow-utils) and `adduser`/`addgroup --system` (frontend, Debian's wrapper) allocate system IDs from different ranges. Not an issue today since the containers don't share volumes, but would matter for file-ownership consistency if a shared bind mount were ever introduced.

Why non-root reduces impact but is not a complete sandbox:

A compromised process running as the non-root `app` user could still: read/modify files the `app` user has permission to access (including runtime secrets like the database URL and signing key, since the process needs to read them to function), make outbound network requests to any service the container can reach, and consume CPU/memory/disk (denial of service).

What non-root prevents: modifying root-owned system files, installing system packages, binding to privileged ports (<1024) without extra capabilities, and gaining control of the host simply by being inside the container.

Conclusion: non-root is one layer of defense-in-depth, not complete isolation - it limits blast radius but doesn't eliminate risk, which is why the security model also relies on scoped secret access (Secret Manager granting only specific secrets to the runtime service account), rather than depending on container user permissions alone to protect sensitive values.

**Step 4 - run an isolated liveness process and inspect**

Backend, run standalone with a fake/unreachable database URL (no real DB dependency needed for liveness):

```text
docker run -d --name module04-backend-test -p 8001:8000 -e DATABASE_URL="postgresql+psycopg://placeholder:placeholder@nonexistent:5432/placeholder" workboard-backend:module04
```

`curl -i http://localhost:8001/health/live` → `HTTP/1.1 200 OK`, `{"status":"alive"}`

Confirms liveness has no database dependency, exactly as designed and previously verified in Module 01's database failure drill.

`docker inspect` results:

- User: `app`
- Env: `[DATABASE_URL=... PATH=... GPG_KEY=... PYTHON_VERSION=3.13.5 PYTHON_SHA256=... PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_DISABLE_PIP_VERSION_CHECK=1]` - confirms the only injected app-specific value is `DATABASE_URL`, everything else is inherited from the base `python:3.13.5-slim` image (Python version/checksum, GPG key for verifying the Python install, pip config). No secrets beyond the one intentionally passed in for this test.
- Ports: `map[8000/tcp:[{0.0.0.0 8001} {:: 8001}]]` - confirms the container's internal port 8000 is correctly mapped to host port 8001 (both IPv4 `0.0.0.0` and IPv6 `::` bindings), matching the `-p 8001:8000` flag.
- Health status: `healthy` - confirms the image's built-in `HEALTHCHECK` instruction is actively running and passing inside this standalone container, independent of Compose.

Frontend, run standalone:

```text
docker run -d --name module04-frontend-test -p 3001:3000 workboard-frontend:module04
```

`curl -i http://localhost:3001/api/health` → `HTTP/1.1 200 OK`, `{"status":"ready"}`

Note: production output is compact JSON (`{"status":"ready"}`, 18 bytes) versus dev-mode's pretty-printed form (`{\n  "status": "ready"\n}`, seen earlier in the session) - Nitro's production build minifies JSON responses while dev mode pretty-prints them for readability. A real, verifiable production-vs-development behavior difference.

Both containers stopped and removed after testing.

**Step 5 - Build cache behavior**

`docker build --target production -t workboard-backend:cache-test backend` (baseline, identical content to `workboard-backend:module04`) → fully cached, `real 0m5.708s`, every layer including `COPY` and `pip install` shows `CACHED`.

Test 1 - trivial change to a late (non-manifest) file (`backend/app/main.py`, added a comment): rebuild → `COPY` layer cache miss (0.2s) → `pip install` layer cache miss, full reinstall, `RUN` step `DONE 76.7s`, total `real 1m30.442s`. Reverted the file, confirmed `git diff`/`git status` clean before the next test.

Test 2 - trivial change to the dependency manifest only (`backend/pyproject.toml`, added a comment, `app/main.py` reverted first to isolate the variable): rebuild → `COPY` layer cache miss again → `pip install` layer cache miss again, full reinstall, `RUN` step `DONE 97.5s`, total `real 1m56.364s`. Reverted the file, confirmed `backend/` fully clean afterward (`git diff --stat` and `git status --short` both empty).

Key finding: `backend/Dockerfile`'s production stage does `COPY --chown=app:app . .` (entire context in one instruction) immediately before `RUN pip install --no-cache-dir .` - there's no separate manifest-first copy step. This means ANY file change in the build context invalidates both the `COPY` layer and the `pip install` layer together, with no way to change application code alone without forcing a full dependency reinstall.

Contrast with `frontend/Dockerfile`'s `dependencies` stage, which does `COPY package.json package-lock.json ./` before `RUN npm ci`, and only copies full source in later stages - so a frontend source-only change does NOT force `npm ci` to rerun, while a backend source-only change always does. This is a real, asymmetric cost between the two Dockerfiles: frontend benefits from dependency-layer caching on every source edit, backend does not.

Follow-up worth raising (not implemented, flagged only): `backend/Dockerfile` could adopt the same pattern - `COPY pyproject.toml` (and any lock file) first, run `pip install`, then `COPY` the rest of the source - to get the same dependency-layer caching benefit frontend already has.

**Step 6 - Build context and exclusions**

Root `.dockerignore`:

```text
.git
.env
**/__pycache__
**/.pytest_cache
**/.mypy_cache
**/.ruff_cache
**/.venv
**/node_modules
**/.nuxt
**/.output
**/coverage
```

`backend/.dockerignore`:

```text
__pycache__
*.py[cod]
.pytest_cache
.mypy_cache
.ruff_cache
.venv
.coverage
htmlcov
```

`frontend/.dockerignore`:

```text
node_modules
.nuxt
.output
coverage
npm-debug.log*
```

Reasoning per category (based on the actual files above, and which `.dockerignore` actually governs each build - `compose.yaml` sets `context: ./backend` / `context: ./frontend`, so only the subdirectory-local `.dockerignore` files apply to those builds, not the root one):

- `.git`: only listed in the root `.dockerignore`, not in either subdirectory one. Doesn't matter in practice - `.git` lives at the repo root, outside both `backend/` and `frontend/` build contexts, so it's excluded structurally rather than by an applicable rule.
- `.env`: same situation - only the root file lists it, and `.env` lives at the repo root, outside both build contexts. Latent gap: if a per-service `backend/.env` or `frontend/.env` were ever introduced, neither subdirectory `.dockerignore` currently has a rule that would catch it.
- Test artifacts: properly excluded via the files that actually matter - `backend/.dockerignore` lists `.pytest_cache`, `.mypy_cache`, `.ruff_cache`, `.coverage`, `htmlcov`; `frontend/.dockerignore` lists `coverage`.
- `node_modules`: correctly excluded via `frontend/.dockerignore`'s explicit entry - the file that actually governs the frontend build context.
- Terraform state: not excluded by any rule in any of the three files (none contain `*.tfstate`, `*.tfvars`, or `.terraform`). Moot today since `infrastructure/gcp/terraform/` is never used as a Docker build context for anything in `compose.yaml` - excluded structurally (out of scope entirely), not by policy. Same latent-gap pattern as `.env`: nothing would actually stop it if root ever became a build context.

Note: `scripts/check-secrets.sh`, referenced in this module's lab instructions and in `docs/security.md` as "a basic local guard," does not currently exist in this repository - confirmed by directory listing (`scripts/` only contains `setup.sh` and `validate-starter.py`). This step of the lab could not be executed as written; flagged as a gap between the module's assumptions and the actual starter state, rather than skipped silently.

**Step 7 - Failure drills**

Drill A - wrong CMD executable:

Changed `backend/Dockerfile`'s production `CMD` to `["nonexistent-binary"]`, rebuilt as `workboard-backend:drill-a` (99.5s - unexpectedly a full cache miss on `pip install` even though only the `CMD` line changed; noted as a minor unexplained anomaly, not investigated further).

`docker run --name drill-a-test workboard-backend:drill-a` → exact error: `exec: "nonexistent-binary": executable file not found in $PATH`, exit code 127 (the standard Unix "command not found" convention). `docker inspect` confirmed `Status=created`, `ExitCode=127`, with the full OCI runtime error chain captured (containerd shim → runc → exec).

Cleaned up (container and drill image removed), `backend/Dockerfile` reverted, confirmed clean via `git status`/`git diff`.

Drill B - missing required environment variable (`DATABASE_URL`):

Ran the backend production container with no `DATABASE_URL` set at all. App started cleanly, no crash - logs show normal Uvicorn startup, and the image's own baked-in `HEALTHCHECK` (polling `/health/live`) passes internally.

`curl -i /health/ready` → `HTTP/1.1 503 Service Unavailable`, `{"detail":"database unavailable"}`.

Root cause, confirmed via `docker exec ... env | grep -i database` (returns nothing, confirming the variable is genuinely unset): `Settings.database_url` in `backend/app/core/config.py` has a hardcoded default value that gets used when `DATABASE_URL` is absent. This means the module's assumption ("remove a required runtime environment variable") doesn't hold for this specific variable - it isn't actually required at container startup at all. The app silently falls back to a default connection string whose hostname (`db`) only resolves inside the Docker Compose network, and the resulting failure only surfaces later, at request time, when `/health/ready` actually attempts to connect.

Second finding within this drill: checked container logs for any trace of the underlying database connection exception (grep for traceback/exception/error) - found nothing. This contradicts a comment in `main.py` claiming "database details belong in logs, not the response." The exception details are correctly excluded from the HTTP response (good security practice, avoids leaking connection internals), but they are also completely absent from logs - a real operational gap. In production, an operator facing a 503 here would have no way to distinguish "wrong password" from "host unreachable" from "database fully down" without much deeper investigation, since nothing is actually logged server-side either.

Cleaned up (container removed). No Dockerfile/code changes were needed for this drill since it only required omitting an env var at run time.

**Step 8 - Signal and shutdown behavior**

| | PID 1 | docker stop time | Verdict |
|---|---|---|---|
| Backend | uvicorn (`app.main:app`) directly, no wrapper | 1.328s | Graceful - logs show "Shutting down" -> "Waiting for application shutdown" -> "Application shutdown complete" |
| Frontend | `node server/index.mjs` directly, no wrapper | 0.947s | Graceful - no shutdown timeout hit (Docker's default is 10s before SIGKILL) |

Both images run the actual application process as PID 1 directly - no tini/dumb-init/docker-init/shell wrapper in between. This matters because a bare PID 1 must handle SIGTERM itself (no init process forwards signals or reaps zombies for it). Both frameworks handle this correctly by default: uvicorn's own signal handler triggers its ASGI shutdown sequence; Node's server closes its listener on SIGTERM. Both containers stopped in under 1.5s, nowhere near Docker's 10s default timeout before escalating to SIGKILL - confirming genuinely graceful shutdown, not a timeout-then-kill fallback.

**Independent challenge - throwaway Dockerfile comparison**

Built a minimal Flask app (`scratch/app.py`, `requirements.txt`) with two Dockerfiles:

`bad.Dockerfile`: `COPY . .` then `RUN pip install`, no `USER` instruction (runs as root).
`good.Dockerfile`: `COPY requirements.txt .` then `RUN pip install`, then `COPY . .`, then `adduser` + `USER appuser`.

Three specific changes and measured effect:

1. Copy order (dependency manifest first vs. copy-everything-first): after touching an unrelated file and rebuilding, bad's `pip install` layer reran fully (13.4s, full reinstall of 7 packages); good's manifest `COPY` and `pip install` both showed `CACHED` (0s spent on dependencies).

2. Non-root user: added `adduser` + `USER appuser` after app files are in place. `docker run --entrypoint whoami` confirmed bad -> `root`, good -> `appuser`. `docker history` shows the additional `RUN adduser` (73.7kB) and `USER appuser` (0B) layers present only in good.

3. Layer ordering relative to volatility: isolating the rarely-changing dependency layer from the frequently-changing source-code layer meant good's second rebuild took ~0.8s total (only the fast `COPY . .` and `adduser` steps reran) versus bad's ~13.4s full reinstall for the same trivial unrelated-file change - roughly a 15x cache-hit speedup.

Cleanup: `scratch/` directory deleted entirely, both `scratch-bad` and `scratch-good` images removed, confirmed neither was ever referenced in `compose.yaml`, and `git status` confirmed clean afterward (no leftover untracked files).

**Self-rating**

- I can repeat this with notes: yes - understand multi-stage builds (dependencies/development/build/production stage separation), why development uses editable installs and production uses fixed installs, why production starts fresh from a base image instead of continuing from a build stage, layer caching (order dependency manifests before source), non-root verification (USER instruction, whoami/id), and how to structure failure drills and throwaway Dockerfile comparisons.
- I can explain it without the reference code: yes - can explain multi-stage builds separate install/dev/build/production concerns so the final image only contains what's needed to run; layer caching reuses unchanged layers based on Dockerfile instruction order; non-root security follows least-privilege - a compromised app only gets the app user's permissions, which reduces but doesn't eliminate impact.
- I can diagnose one failure in this area: yes, with moderate confidence - comfortable with build failures from Dockerfile changes, cache-related rebuild issues, missing dependencies/files, permission and ownership problems, wrong-user containers, health check failures, and dev/production image differences. Would still verify with logs, Docker commands, and project docs for networking, orchestration, or production infrastructure issues.
- Confidence from 1-5: 4/5 - solid grasp of Dockerfile design and container fundamentals; want more hands-on practice diagnosing unfamiliar runtime failures and optimizing builds beyond what this module's drills covered.

---

### Module 05 — FastAPI foundation

**Date and branch**

- Date: 2026-08-05
- Branch: learning/05-fastapi-foundation
- Pull request: none yet

**Objectives in my own words**

Build a real FastAPI application structure with versioned routers, typed settings with production security guards, dependency-injected database access, domain exception mapping, and tested health/status endpoints.

**Work completed so far**

Step 1 - package structure: created `backend/app/api/` (with `router.py` and `routes/` containing `health.py` and `status.py` placeholders) and `backend/app/core/exceptions.py`, matching the module's required structure.

Step 2 - typed settings with a production security guard: expanded `backend/app/core/config.py` from a bare `app_name`/`database_url` pair to include `environment` (`Literal["development", "test", "production"]`), `api_prefix`, `cors_origins`, `secret_key`, access/refresh token durations, and cookie name.

Key addition: a `model_validator(mode="after")` that refuses to construct `Settings` if `environment` is `"production"` and `secret_key` still equals the known demo value - this can only be implemented as a model validator, not a field validator, since it needs to compare two different fields' values together, which a single-field validator has no access to.

Verified directly (not just assumed correct) via `docker compose run --rm backend python -c`: constructing `Settings(environment="production", secret_key=DEMO_SECRET_KEY)` raises the exact expected `ValueError` with a clear message; constructing `Settings(environment="development")` with the demo key succeeds normally. Note: dependencies only exist inside the Docker image (matches Module 04's understanding), so verification had to run through `docker compose run` rather than a bare host `python -c`, which failed with `ModuleNotFoundError` as expected.

**Step 3 & 4 - versioned router, CORS, and health/status contracts**

Created `backend/app/api/routes/health.py`, extracting shared readiness-check logic into a plain helper function (`_check_readiness()`) called by both `/health/ready` and `/health`, rather than one route calling another route directly - keeps HTTP handling separate from the underlying logic, matching the router/service separation described in Module 00's architecture doc.

Created `backend/app/api/routes/status.py` with `GET /status` returning only `service`, `version`, and `environment` from settings - explicitly excluding `database_url`, `secret_key`, or any other sensitive/internal configuration value, per `api-contract.md`'s "do not add secret/config values" requirement.

Wired everything together:
- `backend/app/api/router.py` aggregates sub-routers (`status.router` included)
- `backend/app/main.py` includes `health.router` directly at root (unversioned) and `api_router` under `settings.api_prefix` (`/api/v1`) - keeping infrastructure-level health/liveness checks stable and unversioned, separate from the versioned application API
- Added `CORSMiddleware` reading allowed origins from `settings.cors_origins`

Verified end-to-end with a real `docker compose up --build`:

| Endpoint | Status | Body |
|---|---|---|
| GET /health/live | 200 | `{"status":"alive"}` |
| GET /health/ready | 200 | `{"status":"ready"}` |
| GET /health | 200 | `{"status":"ready"}` |
| GET /api/v1/status | 200 | `{"service":"Workboard API","version":"0.1.0","environment":"development"}` |

Confirms the versioned prefix works correctly (`/api/v1/status`, not `/status`), health endpoints remain unversioned and reachable at root, and the status response contains only the three approved fields.

**OpenAPI verification (evidence screenshot)**

Confirmed via http://localhost:8000/docs: the "health" tag correctly groups all three unversioned root-level routes (`/health/live`, `/health/ready`, `/health`), and the "status" tag shows `/api/v1/status` with the versioned prefix visible directly in the path. Page title and version ("Workboard API", "0.1.0") are pulled dynamically from settings rather than hardcoded, confirming `FastAPI(title=..., version=...)` picks up the typed settings correctly.

**Step 5 - domain exception hierarchy**

Created `backend/app/core/exceptions.py` with a small hierarchy: `AppError` (base, carries `status_code` and `code` as class attributes plus an instance `message`), and `NotFoundError` (404/`not_found`), `UnauthorizedError` (401/`unauthorized`), `ForbiddenError` (403/`forbidden`), `ConflictError` (409/`conflict`), `InvalidTransitionError` (409/`invalid_transition`, deliberately subclassing `ConflictError` rather than `AppError` directly, since an invalid transition IS a conflict with a more specific code - this means code catching `ConflictError` generically also catches `InvalidTransitionError`).

Registered a single exception handler in `backend/app/main.py` (`@app.exception_handler(AppError)`) that converts any raised `AppError` into the `api-contract.md`-specified `{"detail": ..., "code": ...}` JSON shape with the correct status code - avoiding repetitive try/except blocks in every route.

**Step 6 - schema-backed example route**

Created `backend/app/api/routes/example.py` (marked as a temporary Module 05 exercise) with `POST /api/v1/echo`: a Pydantic `EchoRequest` (`name` field with min/max length constraints) and `EchoResponse`, declared explicitly via `response_model` and `status_code` rather than returning a bare dict.

Verified all three distinct behaviors live, via a real `docker compose` rebuild and curl, not just code review:

| Scenario | Status | Body |
|---|---|---|
| Valid request (`{"name": "Elio"}`) | 200 | `{"message":"Hello, Elio!"}` |
| Malformed request (`{}`) | 422 | `{"detail":[{"type":"missing","loc":["body","name"],"msg":"Field required","input":{}}]}` - FastAPI's automatic Pydantic validation error |
| Domain exception trigger (`{"name": "missing"}`) | 404 | `{"detail":"Resource named 'missing' does not exist","code":"not_found"}` - the custom `AppError` -> `handle_app_error` chain firing correctly |

This confirms two genuinely distinct error paths exist and behave differently as designed: FastAPI's built-in schema validation (422, no `code` field) versus the domain-exception hierarchy (custom status codes, always includes a stable `code` field) - directly implementing the error matrix designed in Module 03.

**Step 7 - foundation tests with dependency override**

Extended `backend/tests/test_health.py` (keeping the existing `test_live_health_does_not_require_database` intact) with three new tests using `app.dependency_overrides[get_database_ready]` to simulate database success/failure without touching a real database:
- `test_ready_health_success_with_override`
- `test_ready_health_failure_with_override`
- `test_health_combined_endpoint_uses_same_dependency`

This required first refactoring `backend/app/api/routes/health.py` so the readiness check goes through `Depends(get_database_ready)` instead of being called directly - dependency override only works on functions wired through FastAPI's `Depends()` mechanism, not on plain function calls. During this refactor, caught my own regression before it shipped: an early draft dropped the try/except that converts a raw database exception into a 503, which would have silently changed a controlled 503 into an unhandled 500. Fixed by keeping the exception handling inside `get_database_ready` itself, then verified via a real rebuild that all three original health endpoints still behaved identically post-refactor.

Created `backend/tests/test_api.py` with four more tests: `test_status_response_shape` (confirms only `service`/`version`/`environment` keys are present, explicitly asserting `database_url` and `secret_key` are NOT in the response body), `test_echo_valid_request`, `test_echo_invalid_schema_returns_422`, and `test_echo_domain_error_returns_mapped_404` (verifying the `AppError` -> `handle_app_error` chain).

Ran the full suite for real: `docker compose run --rm backend pytest -v` -> `8 passed, 1 warning in 1.35s`. The one warning (`StarletteDeprecationWarning: httpx with starlette.testclient is deprecated`) is a genuine framework-level deprecation notice, not test noise - flagged as a future dependency-upgrade item, not fixed now since it's out of scope for this module.

**Step 8 - quality gates**

Ran the three required checks for real:

`ruff check .` -> initially passed clean already.
`ruff format --check .` -> initially failed on 4 files (`router.py`, `example.py`, `health.py`, `status.py`) - all missing a blank line between the module docstring and the first import. Fixed by running `ruff format .`, which only inserted the missing blank lines - no logic, ordering, or content changes.
`python -m mypy app` -> initially failed with "No module named mypy" since mypy was never added to `backend/pyproject.toml`'s dev dependencies (only `httpx`, `pytest`, and `ruff` were listed). Added `mypy==1.14.1` to the dev extras, rebuilt the backend image so it actually installs, then ran it for real: `Success: no issues found in 13 source files`.

All three quality gates now pass cleanly: `ruff check .`, `ruff format --check .`, and `mypy app`.

**Independent challenge - request-ID middleware**

Created `backend/app/core/request_id.py`: `RequestIDMiddleware`, a Starlette `BaseHTTPMiddleware` that reads an incoming `X-Request-ID` header if present, otherwise generates a fresh `uuid4`, stores it on `request.state.request_id` (making it available for future logging), and always returns it in the response's `X-Request-ID` header.

Corrected a middleware-ordering mistake before testing: initially registered `RequestIDMiddleware` before `CORSMiddleware`, which (since Starlette applies middleware in reverse registration order - last added is outermost) would have made CORS the outer layer instead of request-ID tagging. Fixed by registering `CORSMiddleware` first and `RequestIDMiddleware` last, so request-ID tagging now wraps everything, including CORS preflight requests.

Verified live via curl:

| Scenario | X-Request-ID response header |
|---|---|
| No ID provided | `ddd05d6d-6737-4db6-b810-e72e208bdf0e` (freshly generated UUID) |
| `test-fixed-id-12345` provided | `test-fixed-id-12345` (preserved exactly, byte-for-byte) |

Created `backend/tests/test_request_id.py` with three automated tests: ID generation when absent, ID preservation when provided, and explicit confirmation that sensitive header values (tested with a fake Authorization bearer token) never leak into response headers - directly satisfying the module's instruction to "test header preservation/generation without logging tokens or bodies."

Full suite now: `11 passed, 1 warning` (the same pre-existing, unrelated `StarletteDeprecationWarning` noted in Step 7) in `3.92s`.

**Self-rating**

- I can repeat this with notes: yes - typed settings with pydantic-settings and a model_validator for cross-field production guards, versioned routing under /api/v1 separate from unversioned health checks, a domain exception hierarchy (AppError base with status_code/code, subclasses for specific errors) mapped through one centralized exception handler, explicit response_model declarations, dependency injection via Depends() for testability, dependency override in tests to avoid real databases, and middleware (RequestIDMiddleware) including correct registration ordering.
- I can explain it without the reference code: yes - dependency injection keeps routes focused on HTTP handling while FastAPI owns dependency resolution, which is exactly what makes app.dependency_overrides possible in tests (only for Depends()-declared dependencies, not direct function calls); the exception-handling chain lets a dependency/service raise a domain exception that a registered handler converts into a consistent structured HTTP response, keeping business logic independent from HTTP response formatting.
- I can diagnose one failure in this area: yes, with moderate confidence - comfortable building typed settings with validation, production safety checks, versioned routing, domain exception hierarchies, centralized exception handlers, dependency-injected testable code, dependency override tests, and middleware including ordering. Would still verify project conventions and documentation for larger production architectures or advanced dependency graphs.
- Confidence from 1-5: 4.5/5 - comfortable with the overall FastAPI architecture and able to reason through similar design decisions; want more experience building larger applications from scratch and handling more advanced production patterns.

---

### Module 06 — PostgreSQL, SQLAlchemy, and Alembic

**Date and branch**

- Date: 2026-08-06
- Branch: learning/06-data-and-migrations
- Pull request: none yet

**Objectives in my own words**

Model the real Workboard entities (users, projects, memberships, tasks, comments) with correct constraints and relationships, configure SQLAlchemy sessions safely, create and exercise a full Alembic migration lifecycle including downgrade, and prove transaction atomicity under a deliberate failure.

**Work completed so far**

Step 1 - design before coding, rule-placement classification:

Practiced classifying business rules into the correct enforcement layer (Pydantic / service / database / frontend) before writing any code, per `database-design.md`'s guidance that a rule can exist in multiple layers for different purposes, but backend enforcement is authoritative.

| Rule | Primary layer | Reasoning |
|---|---|---|
| Task cannot transition backlog -> done directly | Service | A business workflow rule - requires knowing both current and requested state, which Pydantic can't see and the database shouldn't encode as business logic. Frontend can hide the option for UX, but the backend must still enforce it since the API can be called directly. |
| Email must be unique | Database (primary), Service (secondary) | Database UNIQUE constraint is the authoritative guarantee, immune to race conditions. A service-layer pre-check exists only to produce a friendlier error message before hitting the database, not as the real safety net. |
| Project owner cannot be removed from project_members | Service | Depends on the member's role - a business rule requiring lookup and decision logic, not something a raw database constraint or Pydantic schema check can express. |
| due_date must be a valid date, if provided | Pydantic | Pure shape/format validation (`date \| None`) - rejects malformed values (invalid calendar dates, wrong types) before the request ever reaches the service or database layer. |

**Cardinality analysis: Users <-> Projects via project_members**

Users and Projects have a many-to-many relationship: a user can belong to many projects, and a project can have many users. This can't be represented with a simple foreign key on either side, so it requires a junction/join table (`project_members`).

Why `project_members` uses a composite primary key (`project_id`, `user_id`) instead of its own auto-incrementing `id`: the composite key IS the row's identity - the combination itself is what must be unique, expressing "this user is a member of this project" directly. An auto-incrementing `id` alone would not prevent duplicate membership rows (the same `project_id`/`user_id` pair inserted twice) unless a separate unique constraint were added on top of it anyway - so the composite primary key is both more natural (no redundant surrogate key for a pure relationship table) and self-enforcing, rather than needing an extra constraint bolted on afterward.

**Step 2 - engine and session configuration**

Extended `backend/app/db/session.py` with `SessionLocal` (a `sessionmaker` bound to the existing engine, `autoflush=False`, `expire_on_commit=False`) and `get_db()`, a generator-based session dependency compatible with FastAPI's `Depends()`: yields a session, commits on clean completion, rolls back and re-raises on any exception, always closes in a `finally` block. This is the "one session per request" pattern - the alternative (one global session shared across requests) would cause transaction interference between concurrent users, rollback contamination (one user's error undoing another user's uncommitted work), stale cached objects, and race conditions, since SQLAlchemy sessions are not thread-safe and represent a single unit of work.

`autoflush=False` chosen deliberately: the SQLAlchemy default (`autoflush=True`) would automatically write pending changes to the database before any query runs within the same session, which could push unvalidated data to the database mid-request (e.g. before business-rule validation completes). Disabling it means nothing is written until an explicit `flush()` or `commit()`, giving predictable control over when writes actually happen.

Verification, in two stages:
1. First pass tested the generator's control-flow contract (clean completion on success, exception re-propagation on failure) - this passed but only inferred that commit/rollback ran, without directly proving it.
2. Recognized this gap and re-verified with a mock-patched version, asserting directly on `SessionLocal`'s mocked `commit`/`rollback`/`close` calls:
   - Success path: `commit()` called, `rollback()` NOT called, `close()` called.
   - Failure path: `commit()` NOT called, `rollback()` called, `close()` called.

This is a concrete example of the difference between evidence that looks convincing and evidence that's actually conclusive - the first test could theoretically have passed even with a subtly broken commit/rollback implementation, as long as the generator's yield/exception timing happened to match; only direct assertion on the actual method calls closes that gap.

**Step 3 - SQLAlchemy models**

Created `backend/app/db/models.py` with a `Base` declarative class and five entities matching `database-design.md`'s baseline: `User`, `Project`, `ProjectMember`, `Task`, and `Comment`, plus `TaskStatus` and `TaskPriority` enums.

Timestamp design decision: `created_at`/`updated_at` use `server_default=func.now()` (database-generated) rather than a Python-side default like `datetime.utcnow`. Reasoning: the database is the single authoritative time source, immune to clock skew across multiple application server instances (relevant given the architecture's Cloud Run autoscaling), and works correctly even for rows inserted outside the ORM (raw SQL, migrations, other tools).

Relationship design decisions, made deliberately rather than by default:
- `User` <-> `Project` (owner): bidirectional relationship with `back_populates` on both sides (`User.owned_projects`, `Project.owner`) - needed because SQLAlchemy requires `back_populates` on both attributes to recognize them as the same relationship and keep them synchronized in memory; without it, calling `project.owner = user` would not automatically update `user.owned_projects`, risking an inconsistent in-memory object graph until reloaded from the database.
- `Project` -> `Task`: `cascade="all, delete-orphan"` - a task has no meaning without its parent project (matches the ER diagram's "contains" relationship), so deleting a project should delete its tasks. Deliberately NOT applying this pattern to `User` -> `Project`, since a project is a durable business entity that should survive its owner's deletion (ownership can be reassigned; other users may depend on the project's continued existence).
- `ProjectMember.project` / `ProjectMember.user`: unidirectional relationships only (no `back_populates`, no reverse collections on `User`/`Project`) - a deliberate scope decision for this module, not an oversight. Flagged as a known gap: `User`/`Project` currently have no direct `.memberships` collection, which will need either a proper `back_populates` relationship or explicit queries through `ProjectMember` once membership-listing features are built (likely Module 07).
- `Task.assignee_id` and `Comment` (`task_id`, `author_id`): bare foreign key columns with no `relationship()` objects. Deliberate YAGNI decision - no current feature needs to navigate from `Task` to its assignee's full `User` object or from `Comment` to its `Task`/author as Python objects; adding `relationship()` now would be unused complexity. Will add if/when a real feature (e.g. returning assignee details in an API response) needs it.
- `Comment` has no `updated_at`, only `created_at` - treating comments as append-only/immutable for now, consistent with there being no comment-editing feature in the current design scope. Trivial to add later via a new migration if that changes.

All three quality gates pass cleanly against the new models: `ruff check .`, `ruff format --check .`, and `mypy app` (15 source files, no issues). Also caught and fixed a pre-existing, previously unformatted file from Module 05 (`app/core/request_id.py`) during this same formatting pass.

**Step 4 - Alembic initialization**

Added `alembic==1.14.1` as a real runtime dependency (not a dev extra) in `backend/pyproject.toml`, since migrations need to run in production too (matching `docs/architecture.md`'s dedicated `workboard-migrate` Cloud Run job). Rebuilt the backend image to install it.

Ran `alembic init migrations`, generating `backend/alembic.ini` and `backend/migrations/` (`env.py`, `script.py.mako`, `versions/`).

Configured `backend/migrations/env.py` with two required changes:
1. `target_metadata = Base.metadata` (imported from `app.db.models`) instead of `None` - this is what lets `alembic revision --autogenerate` compare the actual database against the five models built in Step 3.
2. Both `run_migrations_offline()` and `run_migrations_online()` now call `config.set_main_option("sqlalchemy.url", get_settings().database_url)` before the URL is used, overriding whatever is in `alembic.ini` with the real, typed settings value - consistent with how `app/db/session.py` already resolves the database URL, and satisfying the module's explicit requirement that "the database URL should come from settings/environment rather than a committed credential."

Confirmed `backend/alembic.ini`'s stock `sqlalchemy.url` placeholder (`driver://user:pass@localhost/dbname`) is Alembic's generic template text, never a real credential, and is now fully overridden at runtime regardless - left in place as an intentional, obviously-fake placeholder rather than removed, since its presence makes clear no real value lives there.

**Autogenerate review — a real gap caught before it broke Step 5**

Generated the initial migration: `docker compose run --rm backend alembic revision --autogenerate -m "initial workboard schema"`. Autogenerate correctly detected all five tables in FK-dependency-safe creation order (`users` -> `projects` -> `project_members` -> `tasks` -> `comments`), with correct indexes, nullability, and the composite primary key on `project_members`.

Caught a real, well-documented Alembic/PostgreSQL gap before running the lifecycle: SQLAlchemy's `Enum` type creates a native PostgreSQL `ENUM` type (`taskstatus`, `taskpriority`) as a side effect of table creation in `upgrade()`, but Alembic's autogenerate does not emit a matching type-drop in `downgrade()` - it only drops tables and indexes. Left as generated, this would have caused `alembic downgrade base` to leave both enum types behind, and the immediately following `alembic upgrade head` (required by Step 5's lifecycle exercise) would have failed with `type "taskstatus" already exists`.

Fix: added explicit cleanup at the end of `downgrade()`, after all table drops:
```python
sa.Enum(name="taskstatus").drop(op.get_bind(), checkfirst=True)
sa.Enum(name="taskpriority").drop(op.get_bind(), checkfirst=True)
```

This directly demonstrates the module's own warning that "autogeneration proposes a migration; it does not understand business intent" and that a human must review "types... and downgrade safety" before trusting generated output - `upgrade()` needed no changes (table creation with its enum side effect worked correctly on the first pass), but `downgrade()` required a manual addition autogenerate simply doesn't know to produce.

**Step 5 - full migration lifecycle**

Ran the complete lifecycle against the real PostgreSQL database:

| Command | Result |
|---|---|
| `alembic upgrade head` | `Running upgrade -> 27edc82c2b1b, initial workboard schema` |
| `alembic current` | `27edc82c2b1b (head)` |
| `alembic history --verbose` | Single revision, parent `<base>`, full metadata shown |
| `alembic downgrade base` | `Running downgrade 27edc82c2b1b -> <base>` - succeeded, including the enum type cleanup |
| `alembic upgrade head` (second time) | Succeeded cleanly - this is the exact step that would have failed with `type "taskstatus" already exists` without the earlier `downgrade()` fix, so this is direct empirical proof the fix was necessary, not just theoretically correct |
| `alembic check` | `No new upgrade operations detected` - no drift between models and database |
| `psql \dt` | All 6 tables present: `alembic_version`, `comments`, `project_members`, `projects`, `tasks`, `users` |

This satisfies three validation checklist items directly: an empty PostgreSQL database reaches head using migrations only, the latest revision can be downgraded and reapplied safely in training, and `alembic check` reports no model drift.

**Step 6 - one incremental migration**

Added a composite index to `backend/app/db/models.py`'s `Task` class: `__table_args__ = (Index("ix_tasks_project_id_status", "project_id", "status"),)` - chosen deliberately over relying solely on the existing single-column `project_id` index, since a query filtering on both `project_id` and `status` together (e.g. "backlog tasks in project X") benefits from an index ordered by both columns: PostgreSQL can jump directly to matching entries rather than finding all rows for a project first and then filtering status afterward on each one. With a large project (e.g. 10,000 tasks, 500 backlog), this meaningfully reduces the amount of data scanned versus using the single-column index alone.

Generated the migration as a genuinely new revision (not editing the applied initial migration, per the module's explicit warning): `docker compose run --rm backend alembic revision --autogenerate -m "add project_id status index on tasks"` -> correctly chained to the initial migration via `down_revision`, and correctly detected only the new index with no unrelated changes. Reviewed `upgrade()`/`downgrade()` - both clean mirror images, no equivalent gap to the earlier enum-cleanup issue since index creation/removal is inherently symmetric.

Full lifecycle verified against the real database, including direct `psql` inspection at each step (not just trusting Alembic's own success messages):

| Step | Result |
|---|---|
| `alembic upgrade head` | `27edc82c2b1b -> 4840454901bd` |
| `alembic check` | `No new upgrade operations detected` |
| `psql \d tasks` | `ix_tasks_project_id_status` present alongside the pre-existing `ix_tasks_project_id` |
| `alembic downgrade -1` | `4840454901bd -> 27edc82c2b1b` |
| `psql \d tasks` | Composite index gone, single-column index still present - confirms downgrade removed exactly and only what it added |
| `alembic upgrade head` (reapply) | Clean, `27edc82c2b1b -> 4840454901bd` again |
| `alembic check` | `No new upgrade operations detected` - final state matches models exactly |

**Step 7 - transaction atomicity test**

Created `backend/app/services/projects.py`, establishing the `services/` layer (matching `docs/architecture.md`'s Router -> Schema -> Dependency -> Service -> Repository -> Model layering from Module 00). `create_project_with_owner(db, name, slug, owner_id, simulate_failure)` creates a `Project`, flushes it (populating `project.id` without committing), then either raises a deliberate `RuntimeError` (`simulate_failure=True`) before creating the `ProjectMember` row, or creates the membership normally.

Key concept verified: `db.flush()` sends INSERT statements to PostgreSQL within the current transaction, making them visible to that transaction, but they remain impermanent until `db.commit()`. If an exception is raised after `flush()` but before `commit()`, a subsequent `rollback()` discards everything the transaction did, including already-flushed inserts - this is why raising mid-function, before any explicit commit, is sufficient to guarantee atomicity, without needing to manually track or undo the first insert.

Created `backend/tests/test_transactions.py`, run against the REAL PostgreSQL database (not SQLite) via `docker compose run`, per the module's explicit warning that "assuming SQLite proves PostgreSQL behavior" is a common failure mode - transaction semantics need to be tested against the actual database engine being used in production.

Two tests, both passing:
- `test_failure_rolls_back_both_inserts`: calls `create_project_with_owner` with `simulate_failure=True`, catches the expected `RuntimeError`, rolls back, then queries the database directly and confirms neither the `Project` row nor the `ProjectMember` row exists.
- `test_success_commits_both_inserts`: calls the same function with `simulate_failure=False`, confirms both rows exist with correct data (including the membership's `role="owner"`), proving the normal success path still works correctly using the identical code path as the failure test - not a special test-only implementation.

Result: `docker compose run --rm backend pytest tests/test_transactions.py -v` -> `2 passed in 1.84s`. This is direct, empirical proof of atomicity, not inference from code review - satisfying the validation checklist item "project plus owner membership is atomic under an injected failure."

**Step 8 - inspecting generated SQL and N+1 detection**

Enabled SQLAlchemy's SQL echo (`logging.getLogger('sqlalchemy.engine').setLevel(logging.INFO)`) to observe actual generated SQL. Two findings:

1. Bulk insert optimization: creating multiple `Task` rows in a loop (`db.add(Task(...))` x3) resulted in a single batched `INSERT INTO tasks` using SQLAlchemy's `insertmanyvalues` optimization, not three separate `INSERT` statements - confirmed by counting the actual SQL statements in the echo output.

2. N+1 query pattern, demonstrated as a scaling problem rather than just a mechanism: with 3 projects each having tasks, accessing `p.tasks` inside a for loop (`Project.tasks` is a default lazy-loaded relationship, no eager-loading configured) triggered 1 query for the projects plus 3 separate queries for tasks (one per project) = 4 total queries for 3 projects. Confirmed the pattern scales linearly: N projects touched -> 1 + N queries.

Fix demonstrated: the same query rewritten with `.options(selectinload(Project.tasks))` produced exactly 2 queries total regardless of N - one for projects, one batched `SELECT ... WHERE tasks.project_id IN (...)` fetching all matching tasks for all projects in a single round trip.

| Approach | Queries for 3 projects | Queries for N projects |
|---|---|---|
| Lazy load (`p.tasks` in a loop) | 4 (1 + 3) | 1 + N |
| `selectinload(Project.tasks)` | 2 | 2 (constant) |

This is a concrete case for why relationship loading strategy matters once real list-view features are built (Module 07's project/task listing) - the default lazy behavior is fine for single-object access but becomes a real performance problem the moment a route needs to return a list of projects each with their tasks.

Bonus verification: cleaned up test data with a real commit (not rollback), which also empirically confirmed the `cascade="all, delete-orphan"` design decision from Step 3 actually works - deleting the 3 test projects correctly cascade-deleted their 6 associated tasks without needing to delete them explicitly.

**Independent challenge - EXPLAIN evidence for the (project_id, status) index**

Generated 8000 test tasks across two projects (target project id 7, ~2667 tasks) with randomly assigned status values, to give PostgreSQL's query planner enough data for a meaningful before/after comparison - a tiny table would likely favor a sequential scan regardless of index presence, since scanning a handful of rows is cheaper than using an index.

Ran `EXPLAIN (ANALYZE, BUFFERS)` for the same query (`WHERE project_id = 7 AND status = 'BACKLOG'`) with the composite index dropped, then restored:

Note: caught and corrected a data issue mid-exercise - SQLAlchemy's `Enum` type stores the Python enum member's `.name` (e.g. `"BACKLOG"`) in PostgreSQL by default, not its `.value` (`"backlog"`), so the query needed to match the stored uppercase form.

Before (single-column `ix_tasks_project_id` only):
- `Bitmap Index Scan` on `ix_tasks_project_id` finds all 2667 rows for `project_id = 7`, then a `Filter` step discards 1737 of them post-scan to match `status = 'BACKLOG'`.
- Execution Time: 1.789 ms

After (composite `ix_tasks_project_id_status` restored):
- `Bitmap Index Scan` on `ix_tasks_project_id_status` uses `Index Cond: ((project_id = 7) AND (status = 'BACKLOG'))` - both conditions are satisfied directly by the index, fetching only the ~930 matching rows.
- `Rows Removed by Filter: 1737` disappears entirely - no post-scan filtering needed.
- Execution Time: 1.050 ms (~41% faster on this dataset)

Write/storage cost discussion: the composite index adds overhead on every INSERT/UPDATE/DELETE to `tasks` (the index must be maintained alongside the data), and consumes additional disk space proportional to table size. This tradeoff is worthwhile here because task listing/filtering by project and status is a core, frequent read pattern for this application (matches the actual Workboard UI's task board view), while task writes are comparatively infrequent - the read-heavy access pattern justifies the write-side index-maintenance cost.

**Self-rating**

- I can repeat this with notes: yes - SQLAlchemy entity design with correct constraints/relationships, one-to-many and many-to-many patterns, back_populates, cascade/delete-orphan, request-scoped sessions with commit/rollback, the full Alembic migration lifecycle (autogenerate, upgrade, downgrade, incremental revisions), transaction atomicity via flush/commit/rollback, and SQL inspection including N+1 detection and index justification via EXPLAIN.
- I can explain it without the reference code: yes - the layer-placement principle (Pydantic for shape/format, service for business workflow rules, database for integrity constraints, frontend for UX only); cascade behavior should represent genuine ownership (a task has no meaning without its project, but a project outlives its owner); the N+1 problem occurs when accessing a lazy-loaded relationship in a loop triggers one query per iteration instead of one batched eager-loaded query.
- I can diagnose one failure in this area: mostly yes - comfortable reasoning about rule placement, relationship design, composite keys, why migrations should be additive not edited in place, why downgrade must fully undo upgrade (including non-obvious side effects like enum types), transaction behavior, and index design. Would be slower on complex Alembic merge conflicts, advanced PostgreSQL performance tuning, and unusual ORM mapping edge cases.
- Confidence from 1-5: 4/5 - can explain concepts, justify design decisions, and solve similar problems with moderate independence. A 5 would mean independently designing schemas, anticipating rollback issues, and optimizing query loading strategies without guidance at production scale - not quite there yet, but the gap is mainly experience with larger systems, not conceptual understanding.

---

### Module 07 — Backend domain architecture and CRUD

**Date and branch**

- Date: 2026-08-08
- Branch: learning/07-backend-domain
- Pull request: none yet

**Objectives in my own words**

Implement real project and task CRUD workflows through the full router -> schema -> service -> repository -> model layering, enforce business rules and transaction ownership in services, return consistent resource-scoped error responses without leaking private resource existence, and build tested list/create/read/update/delete behavior.

**Work completed so far**

Step 1 - external schemas:

Created `backend/app/schemas/projects.py` (`ProjectCreate`, `ProjectUpdate`, `ProjectRead`, `ProjectPublicSummary`) and `backend/app/schemas/tasks.py` (`TaskCreate`, `TaskUpdate`, `TaskRead`), matching `database-design.md`'s models exactly while explicitly excluding internal-only fields.

Three deliberate design decisions confirmed, not left as accidental gaps:

1. `slug` is absent from `ProjectCreate` - slug generation is server-side (service layer), not client-supplied, per `database-design.md`'s design decision.

2. `ProjectPublicSummary` (`task_count`, `completed_task_count`) cannot be built via `model_validate(project)`/`from_attributes`, since those are computed aggregates, not direct `Project` model attributes - this schema will need to be assembled manually from a dedicated repository query, not validated straight from an ORM object.

3. The "field omitted vs. explicitly set to null" problem (`ProjectUpdate.description`, `TaskUpdate.assignee_id`): a plain `Optional` field can't distinguish a client that didn't send a field from one that explicitly sent `null` to clear it - both collapse to the same `None` value after Pydantic parsing. This matters most for `TaskUpdate.assignee_id`, since unassigning a task is a common real action, not an edge case. Resolved architecturally, not in the schema itself: the service layer (Steps 3 and 5) will use `model_fields_set` to check which fields were actually present in the request before deciding what to update.

4. `TaskUpdate.status` accepts any valid `TaskStatus` enum value at the schema level (Pydantic validates it's a real status), but does NOT enforce which transitions are legal (e.g. rejecting `backlog -> done`) - that's a stateful rule depending on the task's current status, which a schema validator can't see in isolation. Consistent with the layer-placement reasoning from Module 06: shape/type validation belongs in Pydantic, but a rule that depends on existing state belongs in the service layer via the dedicated pure transition function required by Step 4.

**Step 2 - repositories**

Created `backend/app/repositories/projects.py` with focused query functions (not a generic repository abstraction, per the module's explicit warning): `get_project_by_id`, `get_project_by_slug`, `list_projects_visible_to_user` (OR of ownership and membership, via `outerjoin` + `distinct` to avoid duplicate rows when a user is both owner and has a membership row), `is_project_visible_to_user` (a dedicated targeted existence check), `get_project_task_counts` (resolving the `ProjectPublicSummary` aggregate gap from Step 1), `slug_exists`, and `get_user_by_email`.

Design reasoning for the dedicated `is_project_visible_to_user` query rather than reusing `list_projects_visible_to_user` and checking membership in the result: a single-resource endpoint like `GET /api/v1/projects/{project_id}` only needs to answer one yes/no question. Reusing the list query would fetch and construct every visible project (potentially hundreds) just to check if one specific ID is among them - wasted I/O, wasted object construction, wasted data transfer. A targeted existence query lets the database use indexes and stop as soon as it finds one matching row, which matters significantly for a single-resource endpoint that will be called far more frequently than the list endpoint.

Noted for later review (Step 9): `get_project_task_counts` currently runs two separate `COUNT` queries rather than one grouped/conditional query - functionally correct, flagged as a potential query-consolidation opportunity rather than fixed now.

**Step 2 (continued) - task repository and add/delete design decision**

Created `backend/app/repositories/tasks.py` with `get_task_by_id_and_project` (filters on BOTH `Task.id` and `Task.project_id` in a single `WHERE` clause) and `list_tasks_for_project`.

Critical security reasoning for filtering on both IDs together rather than fetching by `task_id` alone and checking `project_id` afterward: doing it as two separate steps would mean fetching a task's data before deciding it isn't accessible via this path - a subtle problem even if the data is never returned to the caller. Filtering on both in one query means a mismatched `task_id`/`project_id` combination (e.g. requesting `/projects/5/tasks/99` when task 99 actually belongs to project 3) returns nothing at all - the caller cannot distinguish "task doesn't exist" from "task exists but isn't in this project," which is exactly the resource-scoped 404 semantics designed in Module 03. This directly satisfies the module's validation checklist item "a task cannot be addressed through the wrong project path."

Design decision: no add/delete/flush wrapper functions were added to either repository file (`projects.py` or `tasks.py`). `db.add()`/`db.delete()` calls will happen directly in the service layer via the already-injected `Session`, rather than through trivial repository pass-through functions like `add_task(db, task): db.add(task)` - the module explicitly warns against "creating generic abstractions before repeated behavior exists," and a one-line wrapper around a single SQLAlchemy call adds no domain value.

**Step 3 - project service**

Rewrote `backend/app/services/projects.py`, replacing Module 06's original `create_project_with_owner` (which had a `slug` parameter and a test-only `simulate_failure` flag) with the real implementation:

- `slugify(name)` + `generate_unique_slug(db, name)`: deterministic slug generation (lowercase, non-alphanumeric characters collapsed to hyphens) with a deterministic collision-handling sequence (`website-redesign` -> `website-redesign-2` -> `website-redesign-3`, etc.) rather than random suffixes - determinism matters because the uniqueness-check loop (generate candidate -> check existence -> increment if taken) requires predictable, testable candidates.
- `create_project_with_owner(db, name, description, is_public, owner_id)`: generates the slug server-side, creates the `Project`, flushes to populate its `id`, then creates the owner `ProjectMember` row - reusing the exact flush-before-commit atomicity pattern proven in Module 06.
- `get_visible_project_or_404`: wraps repository lookup + visibility check, raising `NotFoundError` (not `ForbiddenError`) if the project doesn't exist OR isn't visible to the user - a resource-scoped 404 per the Module 03 pattern, so a private project's existence is never confirmed to an unauthorized caller.
- `update_project` / `delete_project`: both raise `NotFoundError` (not `ForbiddenError`) when the requesting user isn't the project owner - same resource-scoped 404 reasoning applied to authorization failures, not just visibility failures. `update_project` takes `update_data: dict[str, Any]` rather than the raw `ProjectUpdate` schema directly - the translation from "schema with omitted vs. explicit-null fields" to "only the fields the client actually sent" (via `model_fields_set`) will happen in the route layer, not here, since deciding which fields were present in the HTTP request is fundamentally a request-parsing concern.
- `get_public_project_summary`: looks up by slug, verifies `is_public`, and assembles a `ProjectPublicSummary` manually using `get_project_task_counts`, since (per Step 1) that schema's fields aren't direct `Project` model attributes.

**Fixing a regression this rewrite caused**

Changing `create_project_with_owner`'s signature broke Module 06's existing `test_transactions.py`, which called the old signature (`slug=...`, `simulate_failure=True/False`) - neither parameter exists anymore. Fixed by rewriting the test to use a genuinely stronger atomicity proof: instead of an artificial `simulate_failure` flag that only exists in test code, the failure test now passes a nonexistent `owner_id` (999999), triggering a real PostgreSQL foreign-key constraint violation (`sqlalchemy.exc.IntegrityError`) when `create_project_with_owner` tries to flush the project insert. This is a more valuable test than the original, since it exercises the actual production failure path (a genuine database constraint) rather than a hand-injected exception that could never occur outside of tests - verifying that SQLAlchemy, PostgreSQL's constraint enforcement, exception propagation, and session rollback all work together correctly, not just that raising an exception triggers a rollback in isolation.

Both tests re-verified against real PostgreSQL: `docker compose run --rm backend pytest tests/test_transactions.py -v` -> `2 passed in 2.53s`.

**Step 4 - task transition rule as a pure function**

Initial design consideration: whether backward transitions (`in_progress -> backlog`, `done -> in_progress`) should be supported, since the module explicitly leaves this as an open design decision to document. My first instinct was to allow some backward transitions (reopening a done task, moving `in_progress` back to `backlog`) for realistic product behavior. Revised after rereading `api-contract.md`, which explicitly states "moving backward is not supported in the baseline" - this isn't an open design choice for the baseline implementation, it's a documented contract requirement. Corrected the transition table to match the spec exactly rather than extending scope based on what seemed reasonable in isolation.

Final policy, explicit and documented (not left implicit in the code):
- Allowed: `backlog->backlog`, `backlog->in_progress`, `in_progress->in_progress`, `in_progress->done`, `done->done` (three same-state no-ops, two documented forward transitions)
- Rejected: `backlog->done` (explicit invalid direct jump per `api-contract.md`), and all three backward transitions (`in_progress->backlog`, `done->backlog`, `done->in_progress`) - backward transitions are entirely out of scope for this baseline, per the contract's explicit statement.

Created `backend/app/services/task_transitions.py`: a pure function, `is_transition_allowed(current, requested)`, with zero database or persistence dependencies - just a dict-of-sets lookup. This is deliberately built and tested before being wired into the task service (Step 5), per the module's explicit ordering requirement.

Created `backend/tests/test_task_transitions.py` with an exhaustive, parametrized test covering all 9 possible `(current, requested)` combinations (the full 3x3 Cartesian product of `TaskStatus`). All 9 pass individually and visibly: `docker compose run --rm backend pytest tests/test_task_transitions.py -v` -> `9 passed in 0.96s`. No database involved - fast, isolated unit tests of pure business logic.

**Step 5 - task service**

Created `backend/app/services/tasks.py`, following the module's mandated 5-step discipline (verify project access -> verify task belongs to project -> validate -> persist once -> return) on every operation: `create_task`, `list_tasks`, `get_task_or_404`, `update_task`, `delete_task`. `get_task_or_404` centralizes the first two steps so `update_task`/`delete_task` cannot accidentally skip them - directly addressing the module's warned failure mode of "putting access checks only in list routes but not update/delete routes."

Check-ordering design confirmed deliberately: `get_task_or_404` checks project visibility (`get_visible_project_or_404`) BEFORE checking task existence within that project. Reasoning: if a user has no access to a project at all, checking task existence first would leak information through response-timing/shape differences (e.g. distinguishing "task exists but forbidden" from "task doesn't exist" across repeated requests would let an attacker enumerate real task IDs inside a project they can't see). Checking project visibility first means every unauthorized request gets the identical 404 response regardless of whether the requested task actually exists, and avoids an unnecessary database query for users who fail the project-level check anyway.

Authorization policy confirmed deliberately (not an oversight): task operations (create/update/delete) are visibility-gated (owner OR member, via `get_visible_project_or_404`), while project-level operations (`update_project`/`delete_project` from Step 3) are ownership-gated (owner only). This means any project member can create, edit, or delete tasks, but only the project owner can modify or delete the project itself - a coherent, common collaborative-work pattern (task work is shared; project-level changes are more consequential and owner-restricted), matching how tools like Trello/Linear separate board-member permissions from board-owner/admin permissions.

Fixed two issues caught during review: removed an unused `TaskStatus` import, and tightened `create_task`'s loose type hints (`priority: str` -> `TaskPriority`, `due_date: Any` -> `date | None`) to match the Step 1 schemas exactly, letting mypy actually catch type mismatches instead of accepting anything.

Quality gates: `ruff check .` and `mypy app` both pass cleanly on the new service files (25 source files, no issues). One pre-existing, unrelated lint warning was found in Module 06's already-applied migration file (`migrations/versions/4840454901bd_...py`: unused `sqlalchemy` import in autogenerated boilerplate) - deliberately left unfixed, since editing an already-applied migration is exactly what Module 06 established as unsafe practice (creates drift risk between environments), and the cosmetic cost of leaving one unused import is far lower than the risk of touching applied migration history.

**Step 6 - versioned routes**

Created `backend/app/api/routes/projects.py` and `backend/app/api/routes/tasks.py`, implementing the full documented API surface from `api-contract.md`: `GET`/`POST /projects`, `GET`/`PATCH`/`DELETE /projects/{id}`, `GET /projects/public/{slug}`, and `GET`/`POST /projects/{id}/tasks`, `GET`/`PATCH`/`DELETE /projects/{id}/tasks/{id}`. Both wired into `backend/app/api/router.py`.

Both route files use `FAKE_CURRENT_USER_ID = 1`, a clearly named, commented placeholder ("temporary until Module 08 authentication") standing in for real authenticated user identity, which doesn't exist yet. This is deliberate scaffolding, not a hidden shortcut - matches the same "document the gap honestly rather than pretend it doesn't exist" principle used for Module 00's mentor-agreement gap. Duplicated across both route files rather than centralized, since Module 08 will replace both instances with real authentication anyway - not worth consolidating a placeholder about to be deleted.

Real bug caught before it shipped: `GET /projects/public/{slug}` was initially registered AFTER `GET /projects/{project_id}` in the route file. FastAPI/Starlette matches routes by path structure in registration order, not by parameter type - `/projects/{project_id}` structurally matches `/projects/public` too (`project_id: int` is only validated after route selection, via Pydantic), so a request to `/projects/public/my-slug` would have matched the wrong route first and failed with an unexpected 422 instead of ever reaching the public-summary handler. Fixed by moving the more specific static-prefix route before the generic parameterized one.

Confirmed connection: PATCH routes use `payload.model_dump(exclude_unset=True)` to build the update dict passed to `update_project`/`update_task` - this is the actual mechanism resolving the "field omitted vs. explicitly set to null" gap flagged in Step 1. `exclude_unset=True` uses Pydantic's internal tracking of which fields were actually present in the request (the same information exposed via `model_fields_set`) to produce a dict containing only client-provided fields: an omitted field is absent from the dict entirely (existing value untouched), while an explicit null is present with value `None` (field intentionally cleared) - exactly the PATCH semantics required.

Also fixed accumulated formatting debt: 13 files written directly across Steps 2-6 had never been run through `ruff format` (repositories, schemas, services, tests, and migration files from Module 06). Ran `ruff format .` once to clean up all of them together.

Quality gates: `ruff format --check .` and `mypy app` both clean (27 source files). `ruff check .` has exactly one known, intentionally unfixed error (Module 06's already-applied migration file's unused import) - unrelated to this module's new code.

**Step 7 - manual contract walkthrough**

Rebuilt and ran the full stack, exercising every endpoint against `api-contract.md`'s documented behavior. One real gap surfaced immediately: the very first request (`POST /projects`) returned a 500, not the expected 201. Root cause: the `users` table was empty - `FAKE_CURRENT_USER_ID = 1` assumes a user with that id exists, and the `projects_owner_id_fkey` foreign key constraint correctly rejected the insert. Fixed by manually inserting a placeholder user with `id=1` via `psql` to unblock the walkthrough.

Decision: not building a permanent seed script for this - `FAKE_CURRENT_USER_ID` is itself temporary scaffolding that Module 08 will delete entirely once real authentication exists, so investing in a reproducible seed mechanism for a placeholder about to be removed isn't worthwhile. Instead, added an inline comment next to both `FAKE_CURRENT_USER_ID` definitions noting that a user with that id must exist, pointing back to this log entry.

Full walkthrough results, all 10 scenarios:

| # | Test | Result |
|---|---|---|
| 1 | `POST /projects` | 201, project created (after fixing the missing seed-user gap) |
| 2 | `GET /projects` | 200, correctly lists the one visible project |
| 3 | `GET /projects/{id}` | 200, correct project |
| 4 | `GET /projects/public/{slug}` | 200, correct summary - confirms the Step 6 route-ordering fix genuinely works in practice |
| 5 | `POST /projects/{id}/tasks` | 201, task created, status defaults to backlog |
| 6 | `GET /projects/{id}/tasks` | 200, correctly scoped list |
| 7 | PATCH task status backlog -> in_progress | 200, valid transition applied |
| 8 | PATCH fresh task status backlog -> done directly | 409, `code: "invalid_transition"` - the transition rule genuinely blocks the documented invalid jump in a live HTTP request, not just in unit tests |
| 9 | `GET /projects/999999` (unknown id) | 404, `code: "not_found"` - resource-scoped 404 |
| 10 | GET a task through the WRONG project's URL (cross-project mismatch) | 404, `code: "not_found"` - confirms `get_task_by_id_and_project`'s combined `WHERE` clause genuinely prevents cross-project task access in a live request, not leaking that the task exists under a different project |

This satisfies the module's Step 7 requirement directly: "Exercise invalid transition, unknown ID, and cross-project task ID. Confirm status/body match documentation" - all three explicitly named edge cases were tested and behaved exactly as the architecture was designed to guarantee.

**Step 8 - automated integration tests**

Created `backend/tests/test_projects_api.py`, testing the real FastAPI app via `TestClient` with `app.dependency_overrides[get_db]` pointing at the real PostgreSQL database (not SQLite), necessary since project/task CRUD genuinely depends on PostgreSQL-specific behavior established in Module 06.

**Caught an inaccurate log entry before it was written**

The first attempt to log this step claimed "four tests, all passing" without re-verifying against the actual last test run. The real last run was `3 failed, 1 passed, 4 errors`. Caught before writing anything false into the evidence record - exactly the discipline this entire course has been building: never record a result without a current, genuine run backing it up.

Two real bugs diagnosed and fixed:

1. `override_get_db()` didn't commit - it yielded a session but never called `db.commit()`, unlike the real `get_db()` dependency. This meant writes made during one request in a test were invisible to the next request within the same test (e.g. a created project appearing to not exist when immediately queried), since nothing was ever actually persisted to the transaction. Fixed by replicating the real dependency's commit/rollback/close behavior in the override.

2. The cleanup fixture's bulk deletes had no `WHERE` clause at all - `delete(Project)` with nothing scoping it attempted to wipe every project row in the table, including unrelated pre-existing data from Module 06 that still had tasks attached, causing a foreign-key violation. Fixed by scoping every delete to `.in_(created_project_ids)`, a list populated only with IDs this specific test run actually created, deleted in correct child-before-parent order (`Task`, then `ProjectMember`, then `Project`).

Reran after both fixes: `docker compose run --rm backend pytest tests/test_projects_api.py -v` -> `4 passed, 1 warning in 4.27s` - a genuine, current, verified result this time.

Four tests: `test_create_and_get_project` (create -> read round trip), `test_duplicate_name_gets_suffixed_slug` (empirical proof of the Step 3 slug-collision algorithm working through the real HTTP layer), `test_unknown_project_returns_404` (resource-scoped 404 shape), `test_public_project_summary_excludes_private_fields` (explicitly asserts `owner_id` is absent, catching accidental data leakage rather than just checking for a 200).

The one remaining warning is the same pre-existing, unrelated `StarletteDeprecationWarning` about httpx/TestClient flagged since Module 05 - investigated and confirmed unrelated to database configuration, ruling out an initial (mistaken) hypothesis that it indicated a database URL scheme problem.

**Step 8 (continued) - task route integration tests**

Created `backend/tests/test_tasks_api.py`, reusing the exact fixture patterns proven in `test_projects_api.py` (commit-on-success `override_get_db`, scoped cleanup via `created_project_ids`).

Four tests, verified passing with a real, current run: `docker compose run --rm backend pytest tests/test_tasks_api.py -v` -> `4 passed, 1 warning in 4.01s`.

- `test_create_task_and_get_it`: create -> read round trip, confirms new tasks default to backlog status.
- `test_valid_transition_succeeds`: backlog -> in_progress via PATCH, confirms 200 and the updated status in the response.
- `test_invalid_direct_transition_returns_409`: backlog -> done directly, confirms 409 with `code: "invalid_transition"`.
- `test_cross_project_task_access_returns_404`: creates a task under Project A, requests it through Project B's URL, confirms 404 with `code: "not_found"`.

The last two tests automate exactly the scenarios manually verified via curl in Step 7 - now permanently regression-tested rather than requiring manual re-verification, directly satisfying the module's requirement that automated coverage exist for "invalid transition" and "cross-project task ID" specifically.

**Step 8 (continued) - mutation testing: proving the tests actually catch bugs**

Deliberately introduced a real bug into `backend/app/services/task_transitions.py`: changed `ALLOWED_TRANSITIONS` so `TaskStatus.BACKLOG` incorrectly included `TaskStatus.DONE` as an allowed transition - directly reintroducing the exact invalid jump `api-contract.md` explicitly forbids.

Ran both relevant suites with the bug in place:

Unit test (`test_task_transitions.py`): the specific parametrized case `test_transition_matrix[BACKLOG-DONE-False]` failed with `"assert True is False"` - the pure function's exhaustive coverage caught the exact broken input immediately, in under a second, with zero database involvement.

Integration test (`test_tasks_api.py`): `test_invalid_direct_transition_returns_409` failed with `"assert 200 == 409"` - the same bug caught at the full HTTP layer too, showing the real, end-to-end consequence: a client would have received a successful 200 response for a request that should have been rejected with a 409.

This is genuine proof the test suite catches real regressions, not just proof the tests pass when the code happens to be correct - satisfying the module's explicit mutation-testing requirement to "break the transition rule intentionally... confirm the correct test fails."

Restored the correct `ALLOWED_TRANSITIONS` dict, confirmed the file matches the original exactly, then ran the FULL test suite (not just the two affected files) to verify the complete codebase: `docker compose run --rm backend pytest -v` -> `30 passed, 1 warning in 5.67s` across all 7 test files (`test_api`, `test_health`, `test_projects_api`, `test_request_id`, `test_task_transitions`, `test_tasks_api`, `test_transactions`) - confirming everything built across Modules 05, 06, and 07 works together correctly, not just the newly-added pieces in isolation.

**Step 9 - reviewing query and transaction behavior**

Applied the SQL-echo inspection habit from Module 06 to the real project/task routes, testing whether the theoretical N+1 analysis holds empirically rather than just trusting the reasoning.

Predicted first (before running): `list_projects` and `list_tasks` should be N+1-safe, since `ProjectRead` and `TaskRead` are flat DTOs with no nested relationship fields (no `owner: UserRead`, no `tasks: list[TaskRead]`) - constructing them only reads scalar columns already present on the originally-queried row, never touching a lazy-loaded relationship like `.owner` or `.tasks`.

Confirmed empirically via SQL echo:
- `list_projects_visible_to_user` + `ProjectRead.model_validate(p)` for 2 projects -> exactly 1 query total, zero additional queries during DTO construction.
- `list_tasks_for_project` + `TaskRead.model_validate(t)` for 2 tasks -> exactly 1 query total, zero additional queries during DTO construction.
- `get_project_task_counts` -> confirmed exactly 2 separate `COUNT` queries (total, then completed `WHERE status='DONE'`), empirically matching the design note already flagged in Step 2 as a known, deliberate-but-unoptimized pattern - not fixed now, same reasoning as before (functionally correct, a genuine but low-priority consolidation opportunity).

Total: 4 queries across all three operations tested, no relationship lazy-loading anywhere. This is a genuine, positive verification result (the design held up under scrutiny), not a bug find - equally valuable to document as the bugs found elsewhere in this module, since it confirms the schema design decision from Step 1 (explicitly flat, no nested relationship data in `ProjectRead`/`TaskRead`) structurally prevents the exact N+1 pattern demonstrated as a real problem in Module 06.

**Independent challenge - task filtering by status and priority**

Implemented the exact endpoint designed (but not built) back in Module 03, Step 6: `GET /api/v1/projects/{project_id}/tasks?status=...&priority=...`, now built consistently with that original design.

Built through all layers:
- `backend/app/repositories/tasks.py`: `list_tasks_for_project_filtered` composes the query incrementally - starts from the `project_id` scope, then conditionally adds `.where()` clauses only for filters the client actually provided, rather than always including every condition. This keeps the generated SQL minimal and readable, and scales cleanly as more optional filters might be added later.
- `backend/app/services/tasks.py`: `list_tasks` accepts optional `status`/`priority` parameters, still enforces the Step 1 access check first before any filtering.
- `backend/app/api/routes/tasks.py`: `status: TaskStatus | None` and `priority: TaskPriority | None` as route parameters - FastAPI automatically exposes these as query parameters and validates them against the enum, which is what gives the 422 response for invalid values for free, satisfying the "validated query parameters" requirement without extra code.

Index consideration, decided deliberately rather than assumed: identified that filtering by priority alone (or status+priority together) doesn't have dedicated index coverage - only `(project_id, status)` exists, from Module 06. Decided NOT to add a new index without evidence, applying the same "measure before optimizing" discipline from Module 06's `EXPLAIN` exercise: priority has low cardinality (only 3 values, roughly a third of rows each), the existing `(project_id, status)` index already covers the most likely common case (status-based board views), and there's no real usage data yet indicating priority-only filtering is frequent enough to justify the write-side maintenance cost of a new index. Documented as a deferred, evidence-based decision, not an oversight - if usage patterns later show priority filtering is common and slow, Module 06's `EXPLAIN` methodology is the established way to re-evaluate this with real data.

Verified live against real data (3 tasks: 1 low priority, 2 high priority): no filter (baseline), `priority=high` (2 results), `status=backlog` (all 3, since none moved yet), combined `status=backlog&priority=high` (intersection), invalid status value (422), and `priority=medium` with no matching tasks (200, empty array) - all six scenarios behaved exactly as designed back in Module 03.

Added 4 automated tests to `backend/tests/test_tasks_api.py`: `test_filter_by_priority`, `test_filter_combined_status_and_priority` (confirms AND logic, not OR), `test_filter_invalid_status_returns_422`, `test_filter_no_matches_returns_empty_list`. Full suite reverified: `docker compose run --rm backend pytest -v` -> `34 passed, 1 warning in 4.78s` (up from 30).

Confirmed via `/openapi.json` (queried directly, not assumed) that `status` and `priority` appear as proper, optional, typed query parameters on the endpoint - each with `schema.$ref` pointing at the `TaskStatus`/`TaskPriority` enum definitions - satisfying the "docs" requirement automatically through FastAPI's OpenAPI generation, no manual documentation needed.

**Self-rating**

- I can repeat this with notes: yes - PATCH schemas with `exclude_unset=True` to distinguish omitted vs. explicit-null fields, focused repository methods (targeted existence checks rather than fetch-and-filter), service-layer business logic and transaction orchestration, resource-scoped authorization applied consistently to both visibility and ownership checks, the pure transition function pattern, thin route controllers, mutation testing to prove tests actually catch regressions, empirical N+1 verification, and incremental optional-filter query composition.
- I can explain it without the reference code: yes - resource-scoped 404s mean authorization is part of resource lookup itself (check access -> 404 if denied -> then look up the resource), not a separate step after finding it, preventing information leakage about resources inside inaccessible parents; the transition rule is a pure function (same input always produces the same output, no database, no side effects) specifically to make it exhaustively unit-testable in isolation before it ever touches persistence; check ordering matters because reversing authorization and resource lookup risks confirming a resource's existence to someone who shouldn't even know to ask.
- I can diagnose one failure in this area: mostly yes - confident building a similar CRUD domain end-to-end (repositories, services, routes, schemas, migrations, authorization, filtering) for an unfamiliar entity set, would likely need to reference exact framework syntax occasionally. Would be slower at designing larger authorization systems, advanced eager-loading strategies, and diagnosing subtle production performance issues.
- Confidence from 1-5: 4/5 - understand the architecture and the reasoning behind each design decision (resource-scoped authorization, focused repositories, pure transition functions, check ordering, incremental filtering), not just the syntax to implement them. The remaining gap toward a 5 is experience applying these patterns independently across larger or unfamiliar systems, not conceptual understanding.

---

### Module 08 — Authentication, authorization, and API security

**Date and branch**

- Date: 2026-08-10
- Branch: learning/08-authentication
- Pull request: none yet

**Objectives in my own words**

Implement real password storage with Argon2, JWT-based access/refresh authentication with a token-type discriminator, a reusable current-user dependency replacing `FAKE_CURRENT_USER_ID` everywhere, deliberate CORS/cookie configuration, and frontend-safe error behavior - explicitly a training baseline, not a production-hardened system.

**Work completed so far**

Step 1 - password storage with Argon2:

Confirmed neither `argon2-cffi` nor a JWT library existed in `backend/pyproject.toml` yet, despite both being named in project docs (`docs/security.md` names `argon2-cffi`; `VERSION_MATRIX.md` pins `PyJWT==2.13.0` specifically, not `python-jose` or `passlib`). Added both as real runtime dependencies (not dev extras), matching the version already specified in the project's own documentation rather than guessing.

Discussed why a fast general-purpose hash (e.g. SHA-256) is unsuitable for passwords even though it's ideal for file integrity checks: SHA-256's speed, which is a feature for integrity verification, becomes a liability for passwords, since a stolen database lets an attacker try billions of guesses per second on commodity hardware. Password hashing algorithms (Argon2, bcrypt, scrypt) are deliberately slow and memory-intensive to make brute-forcing expensive. Also discussed why hashing (irreversible) is correct over encryption (reversible): the application only ever needs to verify a password, never recover it, so there should be no decryption key that could unlock every password at once if the database and key were both compromised.

Created `backend/app/core/security.py` with `hash_password` and `verify_password` using Argon2's `PasswordHasher`. Deliberately narrow exception handling in `verify_password`: only `VerifyMismatchError` (wrong password, a normal/expected authentication outcome) is caught and converted to a clean `False` return. Any other exception (e.g. a malformed or corrupted stored hash) is deliberately allowed to propagate rather than being silently treated as "login failed" - a corrupted hash indicates a real bug or data problem (bad migration, wrong algorithm, manual database tampering) that should be surfaced and investigated, not hidden behind a generic authentication failure message.

Verified all four properties empirically:
1. Correct password verifies -> `True`.
2. Wrong password -> cleanly returns `False` (`VerifyMismatchError` caught as designed).
3. Malformed/non-Argon2 hash -> raises `InvalidHashError`, a genuinely distinct exception, confirming it is NOT silently swallowed by the narrow `except` clause.
4. Hashing the identical password twice produces two different hash strings, confirming Argon2's per-hash random salt is working (this is also why two users with the same password never have identical database rows).

**Step 2 - token claims and type discrimination**

Design discussion before writing code: reasoned through why signature verification must happen BEFORE checking the `token_type` claim, not after. Until a JWT's signature is verified, every claim in its payload (including `token_type`) is untrusted, attacker-controllable data - checking type first would mean making a security decision based on forgeable input. The correct order is: verify signature and expiration first (establishing the payload can be trusted), then inspect claims like `token_type`. This generalizes to a broader principle: never make authorization decisions from untrusted data before authentication has established trust.

Created `backend/app/core/tokens.py`: `create_access_token`, `create_refresh_token`, and `decode_token(token, expected_type)`. Each token carries `sub` (user id), `type` (access/refresh, via a `TokenType` `StrEnum`), `iat`, and `exp`. `decode_token` verifies signature/expiration via PyJWT first, THEN explicitly checks `payload.get("type") == expected_type.value`, raising a custom `InvalidTokenError` on any failure (bad signature, expired, wrong type, or missing/invalid subject).

Deliberate security choice confirmed: the signing algorithm (HS256) is hardcoded in `decode_token`, not read from settings or trusted from the token's own header - this prevents algorithm-confusion attacks, where an attacker crafts a token specifying a different or absent algorithm (e.g. `"alg": "none"`) hoping the server will trust the token's own declaration instead of enforcing one server-side.

Verified empirically with 6 checks, the two most important being the direct proof against Module 08's explicitly named failure mode ("accepting any valid JWT without checking token type"):
1. Access token create/decode round trip -> correct user id.
2. Refresh token create/decode round trip -> correct user id.
3. A genuinely valid, correctly-signed refresh token presented to `decode_token(..., TokenType.ACCESS)` -> correctly rejected with `InvalidTokenError`, proving the cross-type substitution attack designed against is actually blocked in the real implementation, not just theoretically.
4. The reverse case (access token presented as refresh) -> also correctly rejected.
5. A tampered signature (corrupted last 5 characters) -> correctly rejected with a signature verification failure.
6. A garbage, non-JWT string -> correctly rejected with a malformed-token error.

**Step 3 (part 1) - authentication service, with two real security gaps caught before shipping**

Created `backend/app/repositories/users.py` (`get_user_by_email`, `get_active_user_by_id` with query-level `is_active` filtering - chosen deliberately for consistency with login's information-hiding principle, rather than a two-step load-then-check that could distinguish "inactive" from "nonexistent" internally). Moved `get_user_by_email` out of `projects.py` into this new file, consistent with Module 07's "focused repositories per entity" principle - a User-related function didn't belong bolted onto the Project repository.

Design discussion before writing register/login logic: reasoned through why `authenticate_user`'s failure check must be a single combined condition (`user is None or not verify_password(...)`) raising one identical error, rather than two separate checks with different messages - the earlier resource-scoped-404 principle from Module 03 applied to authentication: revealing "no such account" vs. "wrong password" as distinct outcomes would let an attacker enumerate valid emails.

Created `backend/app/services/auth.py` with `register_user`, `authenticate_user`, `create_token_pair`. Two real, non-obvious security gaps were caught during review, both fixed rather than deferred:

1. Timing side-channel: the initial implementation of `authenticate_user` short-circuited on `user is None`, meaning `verify_password`'s deliberately slow Argon2 computation only ran when a matching user existed. Even with an identical error message and status code, this meant response TIMING alone could reveal whether an email was registered - the "constant-style generic error" requirement was satisfied in message content but not in actual behavior. Fixed by always calling `verify_password` unconditionally, using a fixed dummy hash (computed once at module load) when no user is found, so the expensive Argon2 computation runs on every login attempt regardless of outcome.

2. Registration race condition (TOCTOU): `register_user`'s email-uniqueness pre-check (`get_user_by_email` -> `ConflictError`) is the same "friendlier error" pattern already used for project slugs in Module 06/07, where the database's own unique constraint is the true authoritative guarantee - but unlike the slug-generation code, the initial version didn't catch the `IntegrityError` a genuine race (two concurrent registrations for the same email) would raise, meaning a real race would have surfaced as an unhandled 500 instead of a clean 409. Fixed by wrapping `db.flush()` in a `try/except IntegrityError`, converting it to the same `ConflictError`.

Verified the timing fix rigorously, not just once: a single-sample timing check first showed an ambiguous ~13.8ms gap (9% of the ~150ms base) - rather than declaring success or failure from one measurement, reran as a proper statistical comparison across 20 iterations per path with a discarded warmup call. Result: nonexistent-email mean 179.84ms (stdev 39.52ms) vs. wrong-password mean 173.65ms (stdev 40.16ms) - a 6.18ms mean difference, far smaller than either distribution's ~40ms standard deviation, confirming the difference is statistically indistinguishable from noise. Contrasted against the pre-fix gap, which would have been orders of magnitude larger (sub-millisecond vs. ~150-180ms, since `verify_password` wouldn't have run at all) - the fix demonstrably closes a real, measurable side channel, not just a theoretical one.

**Step 3 (part 2) and Step 4 - auth routes, current-user dependency, and full live verification**

Created `backend/app/api/deps.py` with `get_current_user`: extracts the bearer token via FastAPI's `OAuth2PasswordBearer` (a single reusable dependency, not per-route manual logic, per the module's explicit requirement), decodes it as an ACCESS token specifically (reusing the type-discrimination from Step 2), and loads the user via `get_active_user_by_id` - both failure paths (bad/expired/wrong-type token, or user not found/inactive) return the identical 401 "Could not validate credentials" with a `WWW-Authenticate: Bearer` header, per OAuth2 convention.

Created `backend/app/api/routes/auth.py` with all five documented endpoints (`register`, `login`, `refresh`, `logout`, `me`), matching `api-contract.md` exactly: login accepts `OAuth2PasswordRequestForm` (form-encoded, not JSON), returns `{access_token, token_type, expires_in}` and sets the refresh token as an `HttpOnly` cookie scoped to `/api/v1/auth`, with `secure=True` gated on `settings.environment == "production"` (not always-on, since local HTTP development needs `secure=False` to work at all - and not always-off, since production over HTTPS needs it enabled).

Real dependency gap caught and fixed mid-build: the app crashed entirely on startup (`RuntimeError: Form data requires "python-multipart" to be installed`) - `OAuth2PasswordRequestForm` needs this separate package, and it had never been added to `pyproject.toml`, same category of miss as `email-validator` earlier in this module. Added `python-multipart==0.0.20`, rebuilt, confirmed healthy.

Caught before shipping: a prefix-duplication risk, since `auth.router` declares `prefix="/auth"` itself - verified `router.py` includes it the same bare way as `projects.router`/`tasks.router` (no additional prefix argument), and confirmed via the actual OpenAPI schema (not assumed) that all five routes resolve to the correct paths (`/api/v1/auth/register`, `/login`, `/refresh`, `/logout`, `/me`) with no doubling or missing segments.

Full live walkthrough, 9 scenarios, all correct:
1. `POST /auth/register` -> 201, user object (no `password_hash`).
2. `POST /auth/login` (correct credentials) -> 200, real `access_token` + `Set-Cookie: refresh_token=...; HttpOnly`.
3. `GET /auth/me` with the real access token -> 200, correct user info.
4. `POST /auth/refresh` with the cookie -> 200, a genuinely NEW access token (different from the login one).
5. `POST /auth/logout` -> 200, cookie cleared.
6. `GET /auth/me` with no Authorization header -> 401.
7. `GET /auth/me` with a garbage token string -> 401 (decode failure correctly caught).
8. `POST /auth/login` with the correct email but wrong password -> 401, identical generic message to a nonexistent-email attempt (per Step 3's timing-safe design).
9. `POST /auth/register` with an already-registered email -> 409 (the pre-check path, not the race-condition `IntegrityError` path, but confirms the pre-check itself works correctly for the non-concurrent case).

Real inconsistency surfaced by the walkthrough, not yet fixed: three distinct 401 response body shapes exist across the auth surface depending on exactly which check fails - `{"detail":"Not authenticated"}` (FastAPI's own `OAuth2PasswordBearer`, no header at all), `{"detail":"Could not validate credentials"}` (`get_current_user`'s explicit `HTTPException`, bad/expired token), and `{"detail":"Invalid email or password","code":"unauthorized"}` (the app's standard `AppError`/`UnauthorizedError` shape, used by login/refresh). Only the third includes the `code` field every other domain error in this API has. Flagged as a real gap to address, not silently accepted as "it returned 401 so it's fine."

This is the first time the complete auth system (hashing, tokens, timing-safe login, race-safe registration, cookie handling, current-user extraction) has been proven working together through real HTTP traffic, rather than each piece verified only in isolation via direct Python calls.

**FAKE_CURRENT_USER_ID formally retired**

Replaced every use of `FAKE_CURRENT_USER_ID` in `backend/app/api/routes/projects.py` and `backend/app/api/routes/tasks.py` with the real `current_user: User = Depends(get_current_user)` dependency, using `current_user.id` everywhere the placeholder used to be. The constant and its comment (pointing back to this log, added during Module 07's Step 7) are now fully removed - the gap it documented is closed.

Verified live, with a freshly registered and logged-in real user:
- `POST /api/v1/projects` WITH a valid Bearer token -> 201, project created, owned by the real authenticated user.
- `GET /api/v1/projects` WITH the token -> 200, correctly lists the project.
- `POST /api/v1/projects` WITHOUT any Authorization header -> 401 (this exact request would have silently succeeded under the old `FAKE_CURRENT_USER_ID` placeholder, since there was no real check to fail).
- `GET /api/v1/projects` WITHOUT any Authorization header -> 401.

This is the concrete, empirical closure of the scaffolding gap flagged honestly throughout Module 07: project and task routes are now genuinely protected by real authentication, not a hardcoded constant that happened to always succeed.

**Step 5 - authorization audit**

Reviewed every route against two questions: does it require authentication, and if it operates on a specific resource, does it verify the AUTHENTICATED user (not just "any logged-in user") has the correct relationship to that resource. This mattered specifically because every route was originally built and tested exclusively against `FAKE_CURRENT_USER_ID` - a single, unchanging user - meaning no test or manual check before now could have surfaced a genuine multi-user authorization gap.

Full route inventory reviewed:

| Route | Auth required | Resource-level check |
|---|---|---|
| `POST /auth/register`, `/login` | No (by design) | N/A |
| `POST /auth/refresh`, `/logout` | Cookie-based, not Bearer | N/A |
| `GET /auth/me` | Yes | Returns only the caller's own identity |
| `GET /projects/public/{slug}` | No (by design) | `is_public` check in service layer |
| `GET`/`POST /projects`, `GET`/`PATCH`/`DELETE /projects/{id}` | Yes | Visibility (list/get) or ownership (patch/delete) |
| `GET`/`POST /projects/{id}/tasks`, `GET`/`PATCH`/`DELETE .../tasks/{id}` | Yes | Visibility (owner OR member) for all task operations |

Confirmed by design, not oversight: task operations (create/update/delete) are visibility-gated (owner OR member), not ownership-gated - this is the exact policy decided and justified in Module 07. In a genuine multi-user scenario, this means a project MEMBER (not just the owner) can edit or delete another member's tasks. This surprised no one on paper before, since `FAKE_CURRENT_USER_ID` meant "member" and "owner" were always the same single user - now that real distinct users exist, this design consequence is real and worth being deliberate about, but it is not a bug; it matches the documented policy.

Verified `GET /projects/public/{slug}` genuinely requires zero authentication: curl with NO Authorization header returned 200 with the public summary - confirmed empirically, not assumed, since the whole purpose of a "public" endpoint is defeated if it silently required a token.

Caught and investigated a real nuance in `GET /projects/{project_id}`'s response-code consistency: an authenticated stranger (Bob) requesting a private project he doesn't own or belong to gets 404 (resource-scoped, per Module 03's design). But an UNAUTHENTICATED request to the same private project ID returns 401, not 404 - a different status code depending on authentication state. Reasoned through whether this constitutes a leak: it does not, because the 401 response is returned by the `OAuth2PasswordBearer` dependency itself, before the route or service layer ever runs - it fires identically for ANY project ID, real or fake, so an unauthenticated caller learns nothing about which IDs exist. The two-tier design (401 = "prove who you are first", 404 = "now that you have, this isn't available to you") separates authentication from authorization as sequential concerns, which is a common, accepted pattern (e.g. GitHub's own private-repo behavior works the same way).

Empirically confirmed the design holds up under the harder test: compared an authenticated stranger's request to a genuinely NONEXISTENT project ID (999999999) against the same stranger's request to a real, private, unauthorized project ID (70). Both returned byte-for-byte identical response shapes: 404, `{"detail": "Project <id> not found", "code": "not_found"}` - the only difference being the caller's own input echoed back, not any information about the project. This confirms Module 07's `get_visible_project_or_404` design genuinely closes the enumeration channel for authenticated users, which is the harder and more important case to get right, since an attacker with a valid account (not just an anonymous one) is the more realistic threat model for probing private resource existence.

**Step 6 - deliberate CORS configuration**

Design discussion before testing: reasoned through why CORS is not an authorization mechanism. CORS is a browser-enforced restriction on what JavaScript running on a given origin is allowed to READ from a cross-origin response - it does nothing to stop the underlying HTTP request from being made or processed by the server. Non-browser clients (curl, Postman, scripts, mobile apps, other backend servers) don't implement or respect CORS at all, so a request to `POST /api/v1/auth/login` via curl succeeds or fails purely based on server-side authentication/authorization logic, completely independent of any CORS configuration. This is why authentication and authorization must always be enforced server-side, regardless of how tightly CORS is configured.

Reviewed the existing `CORSMiddleware` configuration (`backend/app/main.py`, established in Module 05): `allow_origins` read from `settings.cors_origins` (default: `http://localhost:3000`), `allow_credentials=True`, `allow_methods=["*"]`, `allow_headers=["*"]`.

Ran a real `OPTIONS` preflight test against a disallowed origin to verify the configuration actually enforces what it claims, not just that it's written correctly:

```bash
curl -i -X OPTIONS http://localhost:8000/api/v1/auth/login -H "Origin: https://evil-site.com" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: content-type"
```

Initial concern: curl displayed the full response regardless of the `Origin` header, which could look like a CORS bypass. Correctly reasoned through why this is expected, not a bug: curl doesn't enforce CORS at all (it's not a browser), so it will always show the response - the actual test is whether the response would let a BROWSER's JavaScript read it, which depends entirely on the presence and value of the `Access-Control-Allow-Origin` header, not on whether curl can see the response body.

Confirmed the real answer via the complete, unabridged response headers: `400 Bad Request`, and `Access-Control-Allow-Origin` is entirely absent from the response - not present with an empty value, not present at all. This confirms Starlette's `CORSMiddleware` is correctly refusing to emit the allow-origin header for a disallowed origin, which is exactly the signal a real browser relies on to block page JavaScript from using the response - even though the raw HTTP response still reaches any non-browser client, as expected.

Then ran the same preflight against the ALLOWED origin (`http://localhost:3000`) and confirmed `Access-Control-Allow-Origin: http://localhost:3000` IS present in that response, alongside `allow-credentials: true` and the full allowed methods/headers list - the middleware correctly differentiates based on the actual `Origin` header sent.

**Step 9 - threat notes**

An honest catalog of what this authentication implementation protects against, what it explicitly does not, and why - per `docs/security.md`'s framing that Workboard is "an educational reference" that "demonstrates baseline controls" without production-level hardening.

Real gaps found and fixed this module (empirically verified, not hypothetical):
1. Login timing side-channel: originally, `verify_password` only ran when a matching user existed, meaning response timing alone could reveal whether an email was registered even with an identical error message. Fixed by always running the deliberately-slow Argon2 verification against a dummy hash when no user matches, then rigorously confirmed via 20-iteration statistical timing comparison that the fix closes the gap (6.18ms mean difference against ~40ms standard deviation - statistically indistinguishable from noise).
2. Registration race condition (TOCTOU): the email-uniqueness pre-check alone would have let two concurrent registrations for the same email both pass, with the second failing as an unhandled 500 instead of a clean 409 under real concurrent load. Fixed by catching the database's own `IntegrityError` as the authoritative guarantee, the same pattern already established for project slugs in Module 06/07.
3. Investigated (not a gap): a 401-vs-404 status code difference based on authentication state for `GET /projects/{id}`. Confirmed empirically this does not leak resource existence, since the 401 fires identically for any project ID before the route logic runs at all - the harder case (an authenticated stranger comparing a real private project against a genuinely nonexistent one) returns byte-for-byte identical 404 responses, confirming Module 07's resource-scoped design holds under real multi-user conditions.
4. Confirmed (not a gap): CORS is correctly configured and empirically verified to reject disallowed origins - `Access-Control-Allow-Origin` is entirely absent from preflight responses for an unrecognized `Origin`, with a 400 status. Also explicitly confirmed via design discussion that CORS is not and cannot be an authorization mechanism - it only restricts browser JavaScript, never non-browser clients like curl or scripts, so server-side authentication/authorization remains the only real enforcement boundary regardless of CORS configuration.

Explicitly out of scope for this baseline (per the module's own stated boundary), with concrete impact if exploited:

1. No refresh-token rotation, reuse detection, or revocation. If a refresh token is stolen (compromised device, XSS, etc.), the attacker can repeatedly call `POST /auth/refresh` to mint new access tokens and act as the victim for the token's full lifetime (currently `refresh_token_expire_days`), with no server-side way to distinguish the attacker's use from the legitimate user's - both can refresh independently and simultaneously, since nothing invalidates a refresh token after use. This is precisely the gap the independent challenge addresses.

2. No account lockout or rate limiting on login attempts. Since timing is now normalized (finding #1 above), the remaining risk is unlimited guess attempts - an attacker can attempt unlimited password guesses against a known email with no throttling or lockout, making online brute-force attacks against weak passwords feasible over a long enough time window.

3. No email verification or password reset flow. A registered email is never confirmed to be owned by the registrant, and there is no self-service account recovery path - both explicitly listed in `docs/security.md`'s pre-production checklist.

4. Access tokens cannot be revoked before natural expiration. Logout only clears the refresh cookie; an already-issued access token remains valid until it expires on its own (currently `access_token_expire_minutes`), even if the user "logs out" or an admin wants to force a session to end immediately.

5. This module's CORS configuration is tuned for a same-site local training environment (frontend and backend on localhost, different ports). `docs/security.md` explicitly flags that cross-site custom-domain production deployments need separate review of cookie domain, `SameSite` attribute, and TLS termination - not assumed to already be handled by this training baseline.

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
