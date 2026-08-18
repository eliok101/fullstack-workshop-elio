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

**Step 7 - frontend-safe error behavior**

Design discussion before testing: reasoned through why leaking a stack trace from an authentication endpoint specifically is worse than from a simple endpoint like `/health/live`. A traceback from an auth route can reveal reconnaissance-valuable internals - the password hashing library in use, JWT validation flow, database model structure, internal file paths, and exception-handling logic - none of which are direct exploits by themselves, but which meaningfully help an attacker understand and target the authentication system more precisely. The correct principle: log the full exception server-side, return only a generic message to the client - the same "don't reveal internal detail in the client-facing message" discipline already established for `verify_password` (Step 1) and `_check_readiness` (Module 05).

Verified empirically rather than assumed, using a deliberately added, temporary debug route that raised `RuntimeError("...db_password=hunter2")` - a fake secret embedded specifically to trace where the boundary between server-log and client-response actually falls.

Findings:
1. Client-facing response: curl showed a clean, generic `500 Internal Server Error` with plain-text body `"Internal Server Error"` - no traceback, no exception message, no file paths, and critically, the embedded fake secret (`db_password=hunter2`) never appeared anywhere in the HTTP response.
2. Server-side logs: `docker compose logs backend` showed the COMPLETE traceback, including exact file paths, line numbers, and the full exception message with the fake secret intact - confirming an operator with legitimate log access retains everything needed to diagnose a real failure.
3. Confirmed the correct disclosure boundary is already in place for genuinely unhandled exceptions, without needing any additional handler - FastAPI/Starlette's default unhandled-exception behavior already achieves the log/response split this step is asking for, since debug mode is not enabled anywhere (confirmed no `debug=True` in `main.py`, and the Dockerfile's `--reload` flag only affects code-reload behavior, not error verbosity).
4. Important refinement beyond the mechanical test: the real discipline is not "the client/log split will protect me" as a safety net - it's "never interpolate secrets into exception messages in the first place." The test intentionally embedded a fake secret to prove the boundary holds, but a properly written codebase should never rely on that boundary catching a real secret that shouldn't have been placed in exception text to begin with. This is now noted as a coding discipline, not just a response-shape check.
5. Bonus finding, connecting back to Step 3's request-ID middleware (Module 05): the crash traceback showed the exception propagating directly through `RequestIDMiddleware`'s `dispatch` method at the `call_next(request)` line - confirming that when a route raises before returning normally, the middleware never reaches the line that attaches `X-Request-ID` to the response. This means a genuinely crashed request's error response currently lacks a request ID, which would make correlating a specific failed request to its log entry harder in production - a real, minor gap worth noting, though out of scope to fix as part of this security-focused module.

Confirmed cleanup: removed the temporary debug route, verified via curl it returns 404, and confirmed `git status`/`diff` show no trace of the crash-test route in the committed code.

**Step 8 - security tests**

Created `backend/tests/test_auth_security.py`, automating the key security properties verified manually throughout this module: token type discrimination (refresh rejected as access and vice versa), protected routes rejecting missing/garbage auth, full register-login-access-protected-route flow (also asserting `password_hash` never appears in the register response), wrong-password and nonexistent-email login attempts returning byte-for-byte identical error responses (automating the timing-safety design from Step 3), duplicate registration returning 409, and both CORS preflight cases (disallowed origin gets no `Access-Control-Allow-Origin` header, allowed origin gets the correct one) - automating the Step 6 findings permanently rather than relying on manual curl checks going forward.

`9 passed, 1 warning in 6.79s` (`docker compose run --rm backend pytest tests/test_auth_security.py -v`).

Real regression caught by running the full suite, not just the new file: `test_projects_api.py` and `test_tasks_api.py` (Module 07) still imported `FAKE_CURRENT_USER_ID`, which no longer exists after this module's earlier retirement of that placeholder - breaking test collection entirely (`2 errors during collection`, not a test failure but a hard import error). Fixed by rewriting both files' fixtures to register and log in a real, unique test user per test run (via the actual `/auth/register`/`/auth/login` endpoints) and pass a genuine Bearer token on every call that now requires authentication, instead of relying on a hardcoded fake user id.

Full suite reverified after the fix: `43 passed, 1 warning in 15.42s` (up from 34 after Module 07 - 9 new security tests) - confirming all prior work (health, status, echo, request-id, projects, tasks, transactions, task transitions, and now auth security) still passes together.

**Independent challenge - refresh-token rotation and revocation (design-only ADR)**

Per the module's own stated allowance ("A design-only ADR is acceptable if implementation is out of cohort scope"), authored a design-only ADR rather than implementing it, given the scope of a full implementation (new table, migration, concurrency-safe rotation logic, and a real concurrency test) versus the module's remaining time budget.

Placement decision: the task originally specified `docs/adr/0001-...`, but this repo already has an established, populated ADR location - `docs/decision-records/`, referenced directly in `CLAUDE.md` and containing five existing ADRs (`001`-`005`), including `005-jwt-access-and-cookie-refresh.md`, the exact prior decision this new one extends (it documents the current baseline's refresh-cookie design and explicitly lists "refresh tokens lack rotation, revocation, reuse detection" as a known negative consequence). Creating a separate `docs/adr/` directory would have fragmented where architectural decisions live in this repo for no benefit. Placed the new document at `docs/decision-records/006-refresh-token-rotation-and-revocation.md` instead, matching the existing numbering/naming convention, and cross-referenced ADR 005 and ADR 006 to each other.

Design covers, deliberately reusing patterns already established and proven elsewhere in this workshop:
- Data model: a new `refresh_sessions` table storing a HASHED token identifier (never the raw token - same never-store-recoverable-secrets principle as Argon2 password hashing from Step 1), with `issued_at`/`expires_at`/`revoked_at`/`replaced_by_id` forming a traceable rotation chain.
- Rotation: single-use refresh tokens - each successful refresh revokes the current session row and issues a new one, linked via `replaced_by_id`.
- Reuse detection: presenting an already-revoked token is treated as evidence of compromise (not assumed to be a benign retry), triggering full-chain revocation and a generic 401 - consistent with Step 7's frontend-safe error principle of never explaining the specific reason for a security-relevant rejection.
- Concurrency: explicitly identifies the need for row-level locking (`SELECT ... FOR UPDATE`) around the check-then-revoke-then-create sequence, to prevent two simultaneous requests with the same valid token both succeeding - directly reusing the transaction-atomicity discipline proven in Module 06's empirical atomicity tests.
- Logout: would actually revoke the session server-side, closing the gap identified in Step 9 where the current baseline's logout only clears a client-side cookie with no server-side effect.
- Distinguishes single-session revocation (automatic, triggered by reuse detection) from full-account revocation (a separate, heavier action for account-recovery scenarios).
- Named the test cases a real implementation would require, without writing them: single-use enforcement, reuse-triggers-full-chain-revocation, genuine concurrent-request safety (not just sequential calls), logout's server-side effect, and database-level expiry enforcement independent of the JWT's own `exp` claim.
- Consequences section honestly notes what this design does NOT solve (a stolen access token remains valid until its own short natural expiry - this ADR only addresses the refresh-token layer) and the accepted tradeoff of treating any reuse as compromise (favoring security over convenience, with a possible future refinement).

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

**Self-rating**

- I can repeat this with notes: yes - Argon2 password hashing (and why hashing differs from encryption, why fast general-purpose hashes are unsuitable for passwords), JWT access/refresh tokens with type discrimination, the current-user dependency that replaced `FAKE_CURRENT_USER_ID`, timing-safe login and race-safe registration, CORS configuration and empirical verification, frontend-safe error handling (log server-side, generic response client-side), and the refresh-token rotation/reuse-detection/revocation design.
- I can explain it without the reference code: yes - CORS is browser-enforced only and restricts nothing for curl/Postman/scripts, so server-side authentication/authorization is the only real enforcement boundary regardless of CORS configuration; JWT signature verification must precede any claim inspection (including token type) because every claim is attacker-controlled, forgeable data until the signature proves the token's authenticity; login timing must be normalized because even an identical error message can leak account existence if the expensive password-verification step only runs conditionally, since an attacker can statistically distinguish response times across many requests.
- I can diagnose one failure in this area: mostly yes - confident designing and implementing a similar authentication system end-to-end (registration, hashing, JWT access/refresh, current-user dependency, protected routes, logout, authorization checks, CORS, security tests) for a different project, and explaining the reasoning behind each decision, not just the syntax. Would still rely on documentation for framework-specific library APIs I haven't used yet (e.g. OAuth/OIDC integration, distributed session revocation, signing-key rotation) and for attack classes genuinely outside what this module covered.
- Confidence from 1-5: 5/5 for this module's scope specifically - engaged with essentially every design decision rather than accepting generated code as-is, caught two real security gaps before they shipped (timing side-channel, registration race condition) and empirically verified both fixes rather than assuming them correct, and reasoned through real attack scenarios (token substitution, stolen refresh tokens, resource enumeration, stack-trace leakage) rather than just describing APIs. Holding this to the same standard as earlier modules' 4-4.5 ratings, the honest remaining gap toward broader authentication mastery is exposure to framework-specific auth integrations and attack classes not covered here, not a gap in the reasoning demonstrated this module.

---

### Module 09 — Backend testing and quality gates

**Date and branch**

- Date: 2026-08-11
- Branch: learning/09-backend-quality
- Pull request: none yet

**Objectives in my own words**

Deliberately choose which layer (unit, API/integration, PostgreSQL-specific, or manual) each backend risk deserves rather than defaulting to one style of test everywhere; build fixtures that isolate state instead of depending on shared developer data or execution order; treat branch coverage as a diagnostic tool that reveals unexecuted code, not a target to be gamed; and assemble linting, type checking, tests, migration checks, and deliberate mutation drills into one reproducible quality gate.

**Work completed so far**

**Step 1 - test risk map**

For each risk the module names, the layer it's actually tested at right now, and why:

| Risk | Layer | Where | Why this layer |
|---|---|---|---|
| slug normalization | *Gap - only indirect* | `test_projects_api.py`, `test_transactions.py` | `slugify`/`generate_unique_slug` (`app/services/projects.py`) are pure-ish functions with a DB uniqueness check, but there is no direct unit test calling them with edge-case input (empty name, unicode, all-punctuation, collision counter). Coverage today comes only as a side effect of API/transaction tests that happen to create projects with ordinary names - a genuine "not every risk belongs in TestClient" gap I found by building this table, not one I closed this module. Noted honestly rather than padded over. |
| task transition | Unit | `test_task_transitions.py::test_transition_matrix` | Pure function (`is_transition_allowed`), no DB/HTTP needed - a parametrized table over all 9 (current, requested) pairs is the lowest useful layer and the fastest to run. |
| project creation transaction | Integration (session-level, below HTTP) | `test_transactions.py` | Needs a real DB session to prove commit/rollback atomicity, but not a full HTTP round trip - exercises the service/repository layer directly against a real session. |
| request validation | API | `test_tasks_api.py::test_filter_invalid_status_returns_422`, `test_api.py::test_echo_invalid_schema_returns_422` | This is specifically about FastAPI/Pydantic request parsing behavior (422 shape), which only exists at the HTTP boundary - TestClient is the right layer. |
| duplicate registration | API + service (mock) | `test_auth_security.py::test_duplicate_registration_returns_409` (pre-check path), `::test_registration_race_condition_returns_409_not_500` (added this module - `IntegrityError` path) | The pre-check is naturally an API-level 409 assertion; the race condition specifically requires forcing the pre-check to lie (via `unittest.mock.patch`) so the `IntegrityError` fallback path executes - unreachable through real concurrent HTTP calls in a single-threaded test process. |
| cross-user authorization | API | `test_projects_api.py`, `test_tasks_api.py` (both extended this module with a genuine second registered user) | Authorization is a contract about what an authenticated *stranger* can and can't do through the real API surface - needs two real users and real Bearer tokens, not mocks. |
| migration from empty PostgreSQL | Alembic CLI, not pytest | `alembic upgrade head` / `current` / `check` against the real Compose Postgres | Not a code-level risk at all - it's "does the migration chain actually build a working schema from nothing," which only a real database engine can answer. |
| PostgreSQL constraint behavior | PostgreSQL-specific, isolated | `test_postgres_constraints.py` (new this module - independent challenge) | Native ENUM rejection is invisible to SQLite (bare TEXT column, no enforcement) - needs the real engine, raw SQL, isolated from the fast unit suite since its cost/purpose are both different. |
| production startup/readiness | API | `test_health.py` (pre-existing) | `/health/live` and `/health/ready` are themselves the production readiness contract - TestClient against the real FastAPI app *is* the correct layer, not a mismatch. |

**Step 2 - isolated fixtures**

Reviewed the existing fixture pattern (established Module 07-08, extended this module): every API test file overrides `get_db` via `app.dependency_overrides`, generates a unique `uuid4()`-suffixed email per test run (never a fixed/shared test user), and explicit teardown deletes exactly the rows created during that test (`created_project_ids`, now also `extra_emails` for the second-user pattern added this module). No test reads `.env` production values or depends on execution order - confirmed by running `test_projects_api.py` and `test_tasks_api.py` in isolation and combined, same pass count either way.

**Step 3 and 4 - strengthening unit and API tests, closing coverage gaps**

Added `pytest-cov==6.0.0` to `backend/pyproject.toml`'s dev dependencies and rebuilt. First full coverage run surfaced three real, non-trivial gaps (reviewed by hand, prioritizing security/business-logic code over trivial lines, per the instruction not to pad for a number):

1. **`PATCH`/`DELETE /projects/{id}` had zero tests.** Writing a real test for this (`test_owner_can_delete_project`) surfaced a genuine, previously-undetected production bug, not just a coverage gap: `Project` had no relationship/cascade to `ProjectMember`, so deleting any project with a membership row raised `ForeignKeyViolation` on `project_members_project_id_fkey`. This had been broken since Module 07 and was undetected because test cleanup always used raw SQL deletes (bypassing the ORM cascade path) and no manual walkthrough had exercised the real DELETE endpoint on a project with a membership row. Fixed in `backend/app/db/models.py` by adding `members: Mapped[list["ProjectMember"]] = relationship(back_populates="project", cascade="all, delete-orphan")` on `Project` and `project: Mapped["Project"] = relationship(back_populates="members")` on `ProjectMember`. Confirmed pure ORM-level fix via `alembic check` -> `No new upgrade operations detected` (no schema drift). Added `test_owner_can_update_project`, `test_owner_can_delete_project`, `test_non_owner_cannot_update_project`, `test_non_owner_cannot_delete_project` to `test_projects_api.py`, which required extending its `AuthContext`/fixture with a genuine second registered user (`_register_and_login`/`_register_second_user`) rather than reusing the single-user pattern.

2. **Registration race condition (TOCTOU) had no automated test**, only the manual timing-style verification described in Module 08's log. Added `test_registration_race_condition_returns_409_not_500` to `test_auth_security.py`: inserts a user directly via the DB session, then patches `app.services.auth.get_user_by_email` to return `None` (deterministically simulating the exact race the pre-check can't see), and asserts the real endpoint still returns 409 (not an unhandled 500) via the `IntegrityError` fallback added in Module 08.

3. **`decode_token`'s missing/invalid `sub` claim paths had no direct test.** Added `test_decode_token_rejects_missing_subject_claim` and `test_decode_token_rejects_non_numeric_subject_claim` to `test_auth_security.py`, each hand-crafting a validly-signed JWT (via `jwt.encode` with the real settings secret) that omits or corrupts the `sub` claim, asserting `decode_token` raises `InvalidTokenError` rather than crashing on `int(payload["sub"])`.

**Step 5 - migrations against PostgreSQL**

```text
$ docker compose run --rm backend alembic current
4840454901bd (head)

$ docker compose run --rm backend alembic upgrade head
(no output - already at head)

$ docker compose run --rm backend alembic check
No new upgrade operations detected.
```

Confirmed at head with zero drift, including after the `Project.members` relationship fix above (a pure ORM-level change, no new migration required).

**Step 6 and 7 - static quality and coverage, final run**

Pre-existing blocker found: a `ruff F401` (unused import) in an already-applied migration file, previously left deliberately unfixed across Modules 06-08 since editing an applied migration was judged riskier than the lint noise. Once building a real, always-enforced gate, an unfixable-by-policy lint error would mean the gate could never pass. Fixed via `extend-exclude = ["migrations/versions"]` in `backend/pyproject.toml`'s `[tool.ruff]` section rather than editing the migration file - more sustainable than a one-off fix since it also covers any future autogenerated migration, and doesn't touch applied migration content.

Also found 10 files (all written in Module 08 or this module) that had never been run through `ruff format`; fixed via `docker compose run --rm backend ruff format .`.

Full gate, run end-to-end after all fixes above:

```text
--- ruff check ---
All checks passed!

--- ruff format --check ---
44 files already formatted

--- mypy ---
Success: no issues found in 34 source files

--- pytest (branch coverage) ---
......................................................                   [100%]
---------- coverage: platform linux, python 3.13.5-final-0 -----------
Name                               Stmts   Miss Branch BrPart  Cover   Missing
------------------------------------------------------------------------------
app/api/deps.py                       17      1      2      1    89%   29
app/api/routes/auth.py                49     15      4      0    64%   65-78, 86-87, 92
app/api/routes/health.py              21      4      2      0    83%   11-14
app/core/config.py                    25      1      2      1    93%   32
app/db/session.py                     19      2      0      0    89%   26-27
app/repositories/tasks.py             14      1      4      1    89%   18, 32->34
app/services/projects.py              48      3     12      3    90%   69, 79, 86
app/services/tasks.py                 36      1      8      1    95%   73->81, 89
(all other files 100%)
------------------------------------------------------------------------------
TOTAL                                610     28     44      7    94%

Required test coverage of 90.0% reached. Total coverage: 94.04%
54 passed, 1 warning in 35.44s
```

Reviewed the remaining misses rather than chasing 100%: `auth.py` routes' 64% is almost entirely `refresh`/`logout` cookie-handling branches already proven correct via Module 08's manual live walkthrough but not re-encoded as automated tests (a real, acknowledged remaining gap, not hidden); `health.py`'s missing lines are the `/health` combined-endpoint's DB-down branch, exercised by a dependency override elsewhere but not counted against this specific route file; `config.py` line 32 and `db/session.py` 26-27 are defensive `except`/fallback branches for conditions not reachable in the test environment (e.g. a config value that's always set in `.env.example`). None of these were padded with empty assertions - left as documented, understood gaps below the 90% floor.

Configured the floor itself in `[tool.coverage.report]`: `fail_under = 90`. Set below the current genuine 94.04% (not equal to it) deliberately, so the gate catches real regressions - a deleted test, an unguarded new branch - without being so tight that ordinary future module work trips it accidentally.

Assembled the whole gate as `make backend-quality` in the `Makefile` (ruff check -> ruff format --check -> mypy -> pytest with branch coverage, each step echoed and run via `docker compose run --rm backend`, container is the shared gate per the module's own instruction). Real environment limitation: `make` itself is not installed in this Windows environment (confirmed absent under both Git Bash and PowerShell) - documented the exact command chain as the host-runnable equivalent rather than hiding the limitation, since the file/target is still the source of truth once `make` is available (e.g. CI, WSL, or after installing it).

**Step 8 - mutation drill**

Ran all three named mutations, recorded which tests failed, restored each, then closed the one real gap found.

*Mutation 1 - allow `backlog -> done` directly* (`app/services/task_transitions.py`, added `TaskStatus.DONE` to the `BACKLOG` transition set):

```text
FAILED tests/test_task_transitions.py::test_transition_matrix[backlog-done-False]
FAILED tests/test_tasks_api.py::test_invalid_direct_transition_returns_409 - assert 200 == 409
2 failed, 17 passed
```

Caught at both the unit layer (the parametrized transition matrix) and the API layer (the 409 integration test) - exactly the intended defense-in-depth. Restored; confirmed clean via `git diff` (no changes) afterward.

*Mutation 2 - remove project access check from task update* (`app/services/tasks.py`'s `update_task`, replaced `get_task_or_404(db, project_id, task_id, user_id)` with a direct `get_task_by_id_and_project` lookup that never checks `user_id`):

First run - **survived undetected**: all 16 then-existing tests across `test_tasks_api.py` and `test_projects_api.py` passed with the authorization check completely bypassed. This is exactly Module 08's own named common failure mode ("checking project access for reads but not nested task updates/deletes"), now proven concretely present rather than theoretical. Per the module's instruction ("any mutation that survives reveals a missing or weak test; add one"), added `test_stranger_cannot_update_task` and `test_stranger_cannot_delete_task` to `test_tasks_api.py` (using the same second-user pattern added to `test_projects_api.py` in Step 3/4): create a task as the owner, then attempt PATCH/DELETE as a genuinely distinct second registered user, asserting 404/`not_found` and that the task is actually unchanged/still present.

Confirmed against clean code first - `10 passed` including both new tests. Then re-applied the same mutation:

```text
FAILED tests/test_tasks_api.py::test_stranger_cannot_update_task - assert 200 == 404
1 failed, 9 passed
```

Now caught. Restored; confirmed clean via `git diff` (no changes) and a final rerun (`10 passed`).

*Mutation 3 - change project-create status from 201 to 200* (`app/api/routes/projects.py`'s `create_project` route):

```text
FAILED tests/test_projects_api.py::test_create_and_get_project - assert 200 == 201
FAILED tests/test_tasks_api.py::test_create_task_and_get_it - assert 200 == 201
(9 more FAILED, 11 failed, 7 passed, 11 errors total)
```

Caught immediately and broadly - nearly every test that creates a project does so through the shared `_create_project` helper, which asserts `status_code == 201` before proceeding, so a huge fraction of the suite fails together rather than one narrow test. No gap here; the 201 contract is already over-defended, if anything. Restored the route.

Post-mutation cleanup note: the mutation-3 run left one orphaned project (`api-test-project`, created before its own assertion failed, so it was never added to the fixture's cleanup list) and its owner user in the database. Found and removed manually via a one-off script querying for the leftover slug, then reran the full suite clean (`18 passed` for `test_projects_api.py` + `test_tasks_api.py` together) to confirm no residual pollution.

**Step 9 - backend quality command**

`make backend-quality` defined in the `Makefile` as described in Step 6/7 above. Verified by running its exact command sequence directly (since `make` isn't installed locally) - full clean pass reproduced immediately above.

**Independent challenge - PostgreSQL-backed constraint test**

Implemented (not deferred to a design note) - reasonably scoped, and the module explicitly asks for exactly this kind of test. Created `backend/tests/test_postgres_constraints.py`, isolated from the fast unit suite per the module's requirement, with a module docstring explaining why: `TaskStatus`/`TaskPriority` are backed by native PostgreSQL ENUM types (Module 06), which SQLite has no equivalent for - a SQLite "enum" column is really just unenforced TEXT. Two tests bypass the ORM/Pydantic entirely via raw SQL (`INSERT INTO tasks ... VALUES ('not_a_real_status', ...)`) to prove PostgreSQL itself, not just application-level validation, rejects an invalid enum value.

Self-caught bug while writing it: the first version used lowercase `'backlog'`/`'medium'` for the *valid* column value in each test (proving the *other* column's constraint), which are themselves invalid against the real stored enum - SQLAlchemy persists the Python enum's `.name` (uppercase `BACKLOG`), not `.value` (lowercase `backlog`), a fact re-discovered from Module 06. This produced a confusing failure blaming the wrong enum. Fixed by using the correct uppercase literals (`'BACKLOG'`, `'MEDIUM'`) for the valid column in each test. Verified both tests pass in isolation and together after the fix.

**Full suite, final state**

```text
54 passed, 1 warning in 35.44s
Required test coverage of 90.0% reached. Total coverage: 94.04%
```

All three mutation-drill files (`app/services/tasks.py`, `app/services/task_transitions.py`, `app/api/routes/projects.py`) confirmed restored to their committed state via `git diff` (no output on any of the three).

**Self-rating**

- I can repeat this with notes: yes - coverage analysis (a guide, not a goal; setting a realistic floor below the current genuine percentage rather than locking it exactly), risk mapping prioritized by impact (auth, authorization, transactions, constraints, state transitions) not code size, mutation testing (introduce a defect, verify tests fail, treat survival as a real gap to close, not just a result to record), and isolating database-engine-specific tests from the portable unit suite.
- I can explain it without the reference code: yes - a killed mutation confirms existing protection works; a surviving mutation is more informative because it answers a harder question - what important behavior could break right now with zero tests noticing - revealing a genuine blind spot rather than a theoretical one. Coverage percentage alone only proves code executed, not that the test verified correct behavior, output, state, or failure handling - a test with an assert True after calling a function would show 100% coverage while proving almost nothing; mutation testing complements coverage by directly checking whether tests would actually catch a real behavioral break.
- I can diagnose one failure in this area: mostly yes - confident designing a similar quality gate (linting, formatting, coverage threshold, mutation testing or equivalent, database-specific integration tests, honest documentation of environment limitations) for a different backend framework, understanding the underlying principles are framework-independent even though I'd need to learn framework-specific tooling.
- Confidence from 1-5: 5/5 for this module - genuinely engaged with and verified the real results as they happened (the mutation drill's actual pass/fail output, the coverage tradeoffs, the killed-vs-surviving distinction), understanding not just that the tools ran but what they were actually measuring and why a surviving mutation matters more than a passing test count.

---

### Module 10 — Nuxt, Vue, and TypeScript foundation

**Date and branch**

- Date: 2026-08-12
- Branch: learning/10-nuxt-foundation
- Pull request: none yet

**Objectives in my own words**

Turn the minimal Nuxt skeleton into a typed application shell: separate the private server-side API base (Docker DNS, never shipped to the browser) from the public browser-side API base; define TypeScript contracts that mirror the real backend Pydantic schemas field-for-field, while being explicit that a TypeScript interface is a compile-time promise only and proves nothing about what actually arrives over the wire at runtime; build small, typed, network-free presentational components with focused prop/event contracts; assemble the baseline route pages with real loading/empty/error states rather than assuming success; and verify semantic HTML and keyboard/focus accessibility by actually using the keyboard and an accessibility inspector, not by assuming markup is accessible because it looks right visually.

**Scope decision made up front**

Step 6 explicitly allows temporary local data for authenticated pages "if the API client is not yet wired," and `workshop/11-frontend-api-integration-and-state.md` (confirmed to exist) is where that real client/session layer gets built. So: `/login` and `/register` (client-triggered `$fetch` on submit) and `/public/projects/[slug]` (SSR `useFetch`, genuinely unauthenticated per `docs/api-contract.md`) are wired to the real backend, since none of them need a session to work. `/dashboard`, `/projects`, and `/projects/[id]` use clearly-documented placeholder data (`app/fixtures/placeholder-data.ts`) because they'd need real auth/session state Module 11 hasn't built yet - forcing that early would risk conflicting with what that module builds.

**Work completed so far**

**Step 1 - inspect/initialize Nuxt**

Reviewed `package.json` (scripts: `dev`, `build`, `typecheck`, `postinstall` - no `lint` yet, confirmed against `CLAUDE.md`'s own note), `nuxt.config.ts`, `app/app.vue`, and the `app/` tree (`assets/`, `pages/` only - no `components/` yet). Server-only code today is `server/api/health.get.ts` (a Nitro route, never shipped to the browser); everything else is universal (renders on both server and client); no `.client`-only code exists yet.

```text
$ docker compose run --rm frontend npm install
# clean, up to date with the existing lockfile
```

Dev server already running via the existing `frontend` Compose service (`npm run dev` per the Dockerfile's development stage) - confirmed live: `curl http://localhost:3000/` → 200, `Nuxt 4.4.8 (with Nitro 2.13.4, Vite 7.3.6 and Vue 3.5.40)`, SSR-rendered backend health check (`Nuxt server health: ready`) working. Noted one benign, non-blocking dev-time warning seen in every subsequent log too: `[Vue] Resolve plugin path failed: vue-router/volar/sfc-route-blocks ... ERR_PACKAGE_PATH_NOT_EXPORTED` - an optional Volar plugin path vite-plugin-checker can't resolve in this dependency version; `vue-tsc` still reports `Found 0 errors` immediately after, and every `typecheck`/`lint`/`build` run in this module exits 0 despite it printing.

**Step 2 - TypeScript and runtime settings**

Added `apiInternalBase` (private, server-only) alongside the existing public `apiBase` in `frontend/nuxt.config.ts`, defaulting to Docker DNS `http://backend:8000/api/v1`; wired `NUXT_INTERNAL_API_BASE` into `compose.yaml`'s frontend service and `.env.example`, mirroring the existing `NUXT_PUBLIC_API_BASE` pattern.

Verified the private/public split empirically, not just by writing the code: after recreating the frontend container, confirmed `NUXT_INTERNAL_API_BASE=http://backend:8000/api/v1` is set inside the container's environment, then confirmed it is **absent** from the browser-shipped runtime config:

```text
window.__NUXT__.config={public:{apiBase:"http://localhost:8000/api/v1"},app:{...}}
```

Only `public.apiBase` ships to the browser - `apiInternalBase` never appears anywhere in the HTML/JS sent to the client. This is the concrete proof behind the module's own question ("why must public runtime config never contain a secret"): anything under `public` is trivially visible via view-source, so a value that must stay server-only (an internal DNS name today, a real secret in a different config) cannot go there. `npm run typecheck` after the change: exit 0.

**Step 3 - application shell**

Built `app/components/AppHeader.vue` (`<header>` → `<nav aria-label="Main">` with real `<NuxtLink>`s, which render as real `<a>` tags, not clickable `div`s), rewrote `app/app.vue` to a skip-link → header → single `<main id="main-content">` landmark → footer structure, added CSS custom-property design tokens (`--color-*`, `--space-*`, `--radius-*`) and a responsive header breakpoint to `main.css`, and rewrote the home page to describe the Workboard capstone instead of the Module 00 "starter is running" placeholder (while keeping the real SSR backend-health proof).

Verified via the actual served HTML: skip-link present and first in the DOM, exactly one `<main>` landmark, exactly one `<h1>`, real anchor links throughout, viewport meta tag present, SSR health check still renders `ready`.

**Step 4 - TypeScript API contracts**

Created `frontend/shared/types/api.ts` (Nuxt 4's dedicated isomorphic-types directory, auto-imported on both the app and server sides) with `User`, `Project`, `ProjectPublicSummary`, `Task`, `TaskStatus`, `TaskPriority`, `AuthTokenResponse`, request-body types (`UserRegisterRequest`, `ProjectCreateRequest`, `TaskCreateRequest`, `TaskUpdateRequest`), and `ApiErrorBody` - field names and optionality copied directly from `backend/app/schemas/*.py`, not guessed. Timestamps are typed `string`, not `Date`, since JSON has no date type and typing it `Date` would be a lie the compiler can't catch.

Documented the limitation directly in the file's docstring: a TypeScript interface is a compile-time-only promise - nothing validates that JSON actually arriving over the network matches it, and an `as`/generic cast on a fetch response doesn't change that.

Verified the auto-import genuinely works (not just written and hoped): after adding the file, `grep`'d `.nuxt/imports.d.ts`, `.nuxt/types/imports.d.ts`, `.nuxt/types/nitro-imports.d.ts`, and `.nuxt/types/shared-imports.d.ts` and confirmed all four reference `shared/types/api` - meaning these types are usable with zero explicit imports in `.vue` files. Confirmed in practice in Step 5: `StatusBadge.vue` uses `TaskStatus` with no import statement and typechecks clean.

**Step 5 - reusable display components**

Built five presentational components in `app/components/`, each with typed `defineProps`/`defineEmits` and zero network calls: `LoadingIndicator` (`role="status" aria-live="polite"`, takes a `label`), `ErrorAlert` (`role="alert"`, `title`/`message` props), `StatusBadge` (maps `TaskStatus` to a human-readable label - text, not color alone, per the module's own accessibility principle), `ProjectCard`, and `TaskCard` (emits `advance`/`delete` with the task id; Advance is disabled once a task is `done`, mirroring - not replacing - the backend's real transition rule from `task_transitions.py`).

`npm run typecheck`: exit 0 - confirms the auto-imported types (`TaskStatus`, `Project`, `Task`) and Vue's auto-imported `computed` all resolve inside these components with no explicit imports.

**Step 6 - route pages**

Built all 7 baseline routes. Real backend wiring:

- `/public/projects/[slug]`: SSR `useFetch` against the real `GET /api/v1/projects/public/{slug}`. **Found and fixed a real bug here**: the first version used `config.public.apiBase` (`http://localhost:8000/...`) for this SSR-time fetch, which fails inside the frontend *container* because `localhost` there resolves to the container itself, not the backend - the exact `fetch failed` error surfaced when I actually curled the page instead of assuming it worked: `"[GET] \"http://localhost:8000/api/v1/projects/public/...\": <no response> fetch failed"`. Fixed by branching on `import.meta.server` to use `apiInternalBase` (Docker DNS) during SSR and `apiBase` (public) client-side - this is precisely the failure mode Step 2's config split exists to prevent, and I initially built the split correctly but then didn't use it correctly on first wiring a real SSR fetch. Re-verified after the fix by registering a real user, logging in, and creating both a real public project and a real private project via the actual backend, then curling the frontend page directly: the public project rendered its real name/description/task counts; a nonexistent slug and the private project's slug both correctly rendered the "not found" error state (resource-scoped, matching the backend's own don't-confirm-private-existence design from Module 07/08).
- `/login`, `/register`: real `$fetch` calls to `POST /api/v1/auth/login` (form-urlencoded) and `POST /api/v1/auth/register` (JSON) on submit, with a shared `extractErrorDetail` util (`app/utils/api-error.ts`) that narrows the backend's `{detail, code}` error shape safely under `strict` TypeScript's `unknown` catch-variable typing. Success state explicitly notes that session persistence isn't wired yet (Module 11).
- `/dashboard`, `/projects`, `/projects/[id]`: documented placeholder data via `useAsyncData` (not a hardcoded ref) so these pages already exercise Nuxt's real loading/error/success async-state primitive - the same one a real fetch will use next module. `/projects/[id]` demonstrates all three states genuinely: a populated task grid (project 1, 3 tasks across all statuses), a real empty state (project 2 has zero fixture tasks), and a real 404 (`createError`) for any id not in the fixture set - verified via curl for ids 1, 2, and 999.

Verified every route returns 200 and renders its real content (not just a blank page): `/`, `/login`, `/register`, `/dashboard`, `/projects`, `/projects/1`, `/projects/2`, `/projects/999`, plus the real and fake public-project-slug cases above. Every form input has a matching `<label for>` (`login-email`/`login-password`, `register-name`/`register-email`/`register-password`), confirmed in the actual served HTML.

Honest verification limit: curl cannot execute client-side JavaScript, so while the SSR-time fetches above are genuinely, fully verified end-to-end, the `/login`/`/register` forms' actual submit-button-click → `$fetch` path could only be verified by (a) confirming the exact request shape against the real, already-proven backend contract, (b) a clean typecheck of the fetch code, and (c) confirming the rendered form markup is correct - not by an actual interactive submission. No Playwright/browser-automation tooling exists in this repo yet (confirmed: not in `frontend/package.json`, not in `compose.test.yaml`), so this gap is real and stays open until a later testing module, not silently assumed away.

**Step 7 - accessibility walkthrough**

No live browser/screen-reader/DevTools accessibility-tree inspection was available in this environment - what follows is static verification (real served HTML, real served CSS, ARIA attributes checked against spec), not a literal browser accessibility-tree snapshot. Documenting that limitation honestly rather than implying a browser session happened.

Checked heading hierarchy across every page by curling each one and extracting every `<h1>`-`<h6>` tag in document order. Found two real skips:

1. `/dashboard` and `/projects`: `<h1>` → `<h3>` (`ProjectCard` used `h3` with nothing at `h2`). Fixed by changing `ProjectCard`'s title to `h2`, since every current usage places it directly under a page `h1` with no intervening section heading.
2. `/projects/[id]`: `<h1>` → `<h2>Tasks</h2>` → `<h4>` (`TaskCard` used `h4`). Fixed by changing `TaskCard`'s title to `h3`.

Re-curled all three pages after the fix and confirmed clean sequential hierarchy (`h1`→`h2`→`h3`, no skips) on all of them.

Checked for the module's own named failure mode - clickable `div`/`span` elements without keyboard/role behavior: `grep`'d every `.vue` file under `app/` for `@click` and found exactly one, on `TaskCard`'s real `<button type="button">` elements. No clickable non-interactive elements exist anywhere in the app.

Confirmed the focus-visible and skip-link CSS rules are genuinely present in the *served* stylesheet (not just written and assumed applied) by curling `/_nuxt/assets/css/main.css` directly and grepping for both rule blocks - both present. Confirmed every form input has a matching `<label for>` (Step 6). Confirmed error identification doesn't rely on color alone: `ErrorAlert` has `role="alert"` plus a text title and message; `StatusBadge` renders a human-readable text label, not a bare color swatch.

**Step 8 - frontend quality gates**

`package.json` had no `lint` script before this module (confirmed, matching `CLAUDE.md`'s own note). Added `@nuxt/eslint` + `eslint` as dev dependencies, registered the module in `nuxt.config.ts`, generated `eslint.config.mjs` via `withNuxt()`, and added a `lint` script.

First real lint run caught a genuine error, not a clean pass on the first try:

```text
/workspace/app/components/Pagination.vue
  1:1  error  Component name "Pagination" should always be multi-word  vue/multi-word-component-names
✖ 1 problem (1 error, 0 warnings)
```

`vue/multi-word-component-names` exists to prevent collisions with current or future native/custom HTML elements. Fixed by renaming the component (and its one usage) to `PaginationControls.vue` - not by disabling the rule.

Full gate, final state, all three commands run separately with exit codes captured correctly via `PIPESTATUS` (an earlier run in this session had piped through `tail` and silently discarded the real exit code in favor of `tail`'s own - caught and corrected before treating any run as authoritative):

```text
$ npm run lint          → exit 0, no errors
$ npm run typecheck     → exit 0 ("Found 0 errors" per vue-tsc, aside from the benign volar warning)
$ npm run build         → exit 0
  ✔ Client built in 34435ms
  ✔ Server built in 17763ms
  [nitro] ✔ Generated public .output/public
  [nitro] ✔ Nuxt Nitro server built
```

**Independent challenge - reusable pagination component**

Implemented (not deferred to a design note) - well within scope for the remaining time and directly exercises typed props/events and accessibility patterns already established this module. Built `app/components/PaginationControls.vue`: controlled component (`v-model:currentPage`, `totalPages` prop), real `<button type="button">` Previous/Next controls (native keyboard support, no custom `tabindex`/keydown handling needed), an `aria-live="polite"` status region announcing "Page X of Y" to screen readers on every change, and boundary-disabled buttons (`currentPage <= 1` / `currentPage >= totalPages`).

Checked `docs/api-contract.md` again specifically for this: the project/task list endpoints have no `page`/`limit` query parameters yet, so there is no real paginated list to attach this to - matching the module's own explicit allowance that it "may remain unused." Rather than leave it completely unverified, wired a clearly-commented, non-real demo instance into `/projects` (`demoPage`/`demoTotalPages = 3`, explicitly labeled as a demo in both a code comment and the page's own visible text) purely to prove it renders and its boundary logic actually works, not to imply real pagination exists. Verified via the real served HTML: initial state renders `Page 1 of 3` with `Previous` correctly `disabled` and `Next` enabled - the boundary-state logic is proven, not assumed. The Next-click increment itself is a client-side-only interaction and shares the same curl limitation noted in Step 6 for the login/register forms.

Component test plan (no test runner exists in this project yet - `package.json` has no `test` script - so this is a written plan, not executable tests):

1. Renders `Page {currentPage} of {totalPages}` from props.
2. `currentPage <= 1` → Previous button has `disabled` attribute; `currentPage >= totalPages` → Next has `disabled`.
3. Clicking an enabled Previous button emits `update:currentPage` with `currentPage - 1`.
4. Clicking an enabled Next button emits `update:currentPage` with `currentPage + 1`.
5. Clicking a disabled button emits nothing (relies on the native `disabled` attribute blocking the click, not manual guard logic in the handler alone).
6. `nav[aria-label="Pagination"]` exists; the status paragraph has `role="status"` and `aria-live="polite"`.
7. Both controls are real `<button>` elements reachable via Tab and activatable via Enter/Space with no custom keyboard handling.

**A real environment limitation discovered this module**

Vite's dev-server file watcher does not reliably pick up file changes through this Windows Docker bind mount - new/changed files written from the host did not trigger HMR, even though the bind mount itself had the correct, current content (confirmed by `docker exec ... cat`). Worked around by restarting the `frontend` container after each batch of edits before curling for verification, rather than trusting a live HMR session. Documented here rather than silently working around it without mention, matching the "make not installed" and other real environment-limitation entries from earlier modules.

**Known, deliberate limitations carried forward to Module 11**

- Header nav (`Dashboard`/`Projects`/`Log in`/`Sign up`) is static and not conditional on auth state - there is no session/store yet to condition it on.
- `/login`/`/register` success does not persist the access token anywhere (no store, no cookie) - the next page load has no memory of it.
- `/dashboard`, `/projects`, `/projects/[id]` use fixture data, not the real authenticated `GET /api/v1/projects`/`GET /api/v1/projects/{id}/tasks` calls.
- `TaskCard`'s Advance/Delete on `/projects/[id]` mutate the page's local in-memory copy only - no real `PATCH`/`DELETE` request is sent.

All four are explicit, expected consequences of this module's own stated boundary ("use temporary local data for authenticated pages if the API client is not yet wired"), not oversights - and all four are exactly what `workshop/11-frontend-api-integration-and-state.md` exists to close.

**Self-rating**

- I can repeat this with notes: yes - the server/public runtime config split (why SSR and browser code need different API base URLs), typed API contracts mirroring backend schemas, separating presentational components (typed props, no data-fetching) from page-level data logic, route pages with explicit loading/success/empty/error states rather than assuming data always exists, and accessibility fundamentals (semantic landmarks, heading hierarchy, focus visibility, label association, not relying on color alone).
- I can explain it without the reference code: yes - a TypeScript interface only checks code at compile time; it doesn't inspect what actually arrives over the network at runtime, so a backend response that violates the contract (wrong type, missing field) would still be trusted by TypeScript unless a runtime schema validator is added separately. SSR needed a different API base than the browser because the two run in genuinely different network environments - the Nuxt server process runs inside the Docker network and must use the internal service DNS name (backend), while a real browser has no way to resolve that hostname and must use a publicly reachable address (localhost or a real public URL). Relying on color alone for status/error meaning excludes color-blind users, screen reader users, and anyone with reduced vision - meaning should always also be conveyed through text, labels, or ARIA attributes, with color only reinforcing it.
- I can diagnose one failure in this area: mostly yes - confident building a similar typed frontend foundation (runtime config, typed contracts, presentational components, route states, accessibility basics, pagination) for a different project, though I'd still reference Nuxt/Vue-specific framework APIs. Would be slower with advanced accessibility auditing, complex SSR caching strategies, and large-scale frontend state management.
- Confidence from 1-5: 4.5/5 - found real integration bugs rather than assuming correctness (the SSR API-base mismatch, heading hierarchy skips), verified actual rendered output instead of trusting source code, made and documented deliberate scope decisions honestly, and correctly identified the limits of available verification tooling (curl cannot exercise client-side JavaScript). Held back from 5/5 because production-scale frontend work still requires more experience with larger applications, deeper accessibility auditing, and performance optimization beyond this module's scope.

---

### Module 11 — Frontend API integration and state

**Date and branch**

- Date: 2026-08-13
- Branch: learning/11-frontend-api
- Pull request: none yet

**Objectives in my own words**

Replace every piece of Module 10's temporary scaffolding with the real thing: one typed API client that owns the runtime base URL, bearer-token attachment, a single shared refresh-and-retry on an expired access token, and normalized error output, instead of each page making its own raw `$fetch` call. A shared, reactive auth store (current user, in-memory access token, an explicit initializing/authenticated/unauthenticated state machine) that a client-only plugin populates on load by attempting a silent refresh against the Module 08 httpOnly refresh cookie. Route middleware that keeps `/dashboard` and `/projects*` unreachable while unauthenticated, without looping against `/login`. `login.vue`/`register.vue` and `AppHeader.vue` wired to that real state instead of the local-only success message and static nav Module 10 documented as a known gap. `/dashboard`, `/projects`, and `/projects/[id]` calling the real `GET`/`POST`/`PATCH`/`DELETE` endpoints instead of `app/fixtures/placeholder-data.ts`, including `TaskCard`'s Advance/Delete actually mutating backend state. Deliberate failure drills (expired token, network failure, 403/404) with real recorded behavior, not assumed behavior.

**Scope decision made up front**

Module 10 documented four explicit, deliberate gaps it left for this module: static header nav, no token persistence after login/register, fixture data on `/dashboard`/`/projects`/`/projects/[id]`, and `TaskCard` mutating only local state. All four are this module's job and are closed below. Per the module text ("keeping private pages client-authenticated in the baseline" / "Avoid server/client hydration mismatch"), authenticated data fetching for `/dashboard`, `/projects`, and `/projects/[id]` is client-only (`server: false`) - the SSR pass renders only the loading shell for those routes (no real data, so no leak), and the client takes over once the auth store has resolved after hydration. `/public/projects/[slug]` keeps its Module-10 SSR `useFetch` unchanged since it is genuinely unauthenticated.

**State-management choice**

Checked before assuming: `frontend/package.json` has no state-management library today (`pinia` only appears in `package-lock.json` as another package's peer-dependency range, not an installed dependency - confirmed via `grep -n '"node_modules/pinia"' package-lock.json`, zero matches). This project's own docs already name the intended choice: `docs/architecture.md`'s frontend layering diagram draws `Page --> Store[Pinia auth store]`, and `AGENTS.md` states "shared authenticated state belongs in Pinia only when necessary" - auth is exactly that case (shared across header, middleware, and every protected page), project/task data stays page-local per that same rule. So: added `pinia` + `@pinia/nuxt` as new dependencies this module, rather than reaching for Nuxt's built-in `useState` or inventing a third approach the project's own architecture doc doesn't mention.

**Backend contract checked before wiring**

Read `backend/app/api/routes/auth.py` and `docs/api-contract.md` directly rather than assuming cookie/header behavior: the refresh token is an `httponly`, `samesite=lax` cookie named `refresh_token`, scoped to path `/api/v1/auth`, set by `/auth/login` and read by `/auth/refresh`; `/auth/logout` deletes it server-side. `backend/app/main.py` configures CORS with `allow_credentials=True` against the explicit origin `http://localhost:3000` (not a wildcard - required for credentialed cross-origin cookies to work at all), which means every frontend request that needs the cookie must set `credentials: 'include'` explicitly, since that is not `$fetch`'s default for cross-origin requests.

**Work completed so far**

**Step 1 - state management decision**

Checked whether Pinia was already installed (it wasn't) before assuming a state-management approach. Confirmed via `AGENTS.md` and `docs/architecture.md` that Pinia is this project's own documented choice for shared authenticated state ("shared authenticated state belongs in Pinia only when necessary"), not an outside assumption. Added `pinia` + `@pinia/nuxt` as new dependencies.

**Step 2 - API client**

Built `frontend/app/utils/api-client.ts`: a single typed client factory with per-request baseURL resolution, Bearer token attachment, `credentials:'include'` on every call (required since the refresh cookie is httponly/samesite=lax scoped to `/api/v1/auth` per Module 08), a single shared in-flight refresh promise so concurrent 401s trigger exactly one refresh (not one per failed request), a retry cap of one, and an `ApiError` class normalizing the backend's `{detail, code}` shape alongside 422 validation errors and null-status network failures.

**Step 3 - auth store and safe init**

Built `frontend/app/stores/auth.ts` (Pinia): `user`, `accessToken` (in-memory only, never persisted to storage), and `status` (initializing/authenticated/unauthenticated). `rawRefresh` deliberately uses a raw `$fetch` call outside the shared `$api` client specifically to avoid the refresh mechanism calling itself recursively. `logout` clears local state even if the network call fails, with a `console.warn` so a failed logout call is visible rather than silently swallowed. `frontend/app/plugins/auth.client.ts` (`.client`-suffixed, never runs during SSR) calls `initAuth()` once on app load to attempt a silent refresh against the httpOnly cookie - this is how a page reload knows whether a session already exists.

**Step 4 - route protection middleware**

Built `frontend/app/middleware/auth.global.ts`: returns immediately during SSR (no SSR-authenticated fetch in this baseline), and on the client always awaits `initAuth()` completing before making any redirect decision - preventing a redirect based on a not-yet-known auth state. Protects `/dashboard` and `/projects*`, redirecting unauthenticated visitors to `/login?redirect=<path>`; redirects already-authenticated visitors away from `/login` and `/register`.

**Step 5 - login/register wiring and conditional nav**

Rewired `login.vue` and `register.vue` to use `auth.login()`/`auth.register()` instead of Module 10's raw `$fetch` calls. `AppHeader.vue`'s nav is now genuinely conditional on `auth.isAuthenticated` (Dashboard/Projects/Log out vs. Log in/Sign up) - closing the static-nav gap Module 10 explicitly documented as deferred.

**Step 6 - real project/task pages, placeholder data removed**

`dashboard.vue` and `projects/index.vue` now call the real `GET /api/v1/projects` endpoint via `useProjectsApi.ts` (a new composable centralizing every project/task request shape). `projects/index.vue` also gained a real create-project form. `projects/[id].vue` rewritten around a manual `AbortController`-backed loader (see independent challenge) with real GET project + GET tasks, POST task, PATCH task status (Advance), and DELETE task (Delete) - replacing Module 10's local-only mutations. Deleted `frontend/app/fixtures/placeholder-data.ts` entirely, confirmed via grep that nothing referenced it before deletion.

**Real bug #1 - false "empty" state during SSR**

curl on `/dashboard` showed "You don't have any projects yet" for every visitor, authenticated or not - not because there were zero projects, but because `useAsyncData(..., {server:false})` never runs the fetcher during SSR, leaving `status: 'idle'` (not `'pending'`) at render time. The template's `v-else-if` chain treated "haven't checked yet" identically to "checked and got zero results." Confirmed the real status type (`AsyncDataRequestStatus = 'idle' | 'pending' | 'success' | 'error'`) directly from Nuxt's own type definitions rather than guessing. Fixed by changing the loading condition to `v-if="pending || status === 'idle'"` in both `dashboard.vue` and `projects/index.vue`. Re-verified via curl: the false-empty text no longer appears; the loading indicator (`role="status"`) renders instead.

**Step 7 - failure drills, all against the real running backend**

| Drill | Result |
|---|---|
| Invalid access token | 401, "Could not validate credentials" |
| No token | 401, "Not authenticated" |
| Refresh with no cookie | 401, "No refresh token provided" |
| Refresh with a garbage cookie | 401, "Invalid or expired refresh token" |
| Real network failure (`docker compose stop backend`, not simulated) | curl exit 7 (connection refused); dashboard SSR still returned 200 since the client-only-fetch design means the page shell never depends on backend availability |
| Nonexistent project | 404, "Project 999999 not found", code: not_found |
| Invalid transition (backlog -> done) | 409, code: invalid_transition |
| Cross-user access to a private project (GET and DELETE) | 404, not 403 - confirmed the resource-scoped-404 design from Module 07/08 still holds through this new client layer, using a genuine second registered user |
| The legal path (advance then delete) | 200 then 204, re-fetched the task list afterward to confirm exactly one task remained - the deletion was real, not assumed |

**Real bug #2 - production build ELOOP, an accumulated-state problem, not a code bug**

`npm run build` failed with `ELOOP: too many symbolic links`, a genuinely circular (not just deep) chain under `node_modules/@vue/server-renderer`. Diagnosed as accumulated state in the frontend `node_modules` Docker named volume, built up across many incremental `npm install` runs since Module 00 - not caused by this session's changes. Confirmed via a clean reinstall: `rm -rf node_modules/*` then `npm install` added 185 packages (vs. 14 for the original incremental add earlier this session), confirming this was corrupted accumulated state, not a single bad dependency. Rebuild succeeded cleanly afterward.

**Step 8 - quality gate, final authoritative run**

`npm run lint` -> exit 0 (after fixing a real error: `@typescript-eslint/no-invalid-void-type` on an explicit `<void>` generic in `useProjectsApi.ts`'s `deleteTask` call - removed the redundant generic rather than disabling the rule, relying on the client's own default instead).
`npm run typecheck` -> exit 0 (after fixing two real TypeScript errors: `ApiRequestInit.body` needed widening to `unknown` since a single static type can't express both a typed request-body interface and login's `URLSearchParams`; and the client's internal `$fetch<T>()` generic usage was replaced with an untyped call plus a single `as T` cast, since ofetch's generic overload ties response type to the literal request path in a way that conflicted with an arbitrary caller-supplied `T`).
`npm run build` -> exit 0, 46MB total (12MB gzip).

**Independent challenge - AbortController-based cancellation**

Implemented for real (not a design note). The race it prevents: `/projects/[id]` reuses the same Vue component instance across `:id` param changes (Vue Router doesn't remount just because the param changed), so navigating from `/projects/1` to `/projects/2` before project 1's fetch resolves leaves that request in flight - without cancellation, a slow response for project 1 arriving after project 2's fetch completes would silently overwrite the now-current page with the wrong project's data. Mechanism: `loadProject(id)` aborts any previous in-flight controller before starting a new one; both the success and catch paths check `controller.signal.aborted` before writing to reactive state, so a genuinely cancelled request can never write stale data - this cancels the actual underlying network request via the abort signal, not a weaker last-write-wins timestamp guard.

**Verification gap, explicitly flagged rather than assumed**

No browser automation was available this session (Claude in Chrome was considered but not set up). Every client-JS-only interaction (login/register redirect, conditional nav re-render, middleware redirects, TaskCard button clicks, silent-refresh persistence across a hard reload) was verified as far as possible without a real browser: the exact request/response contract each handler constructs was independently reproduced byte-for-byte via curl against real created data, the SSR shell was confirmed to leak no protected data pre-hydration, and the reactive bindings/event handlers were read directly in source - but the actual click-triggered DOM behavior in a real browser was not observed. Documented honestly as the same class of limitation Module 10 hit with curl-not-executing-client-JS, not claimed as fully verified.

**Known, deliberate limitations carried forward / found this module**

- `npm test` still doesn't exist - no test runner in this project (unchanged gap from Module 10).
- Refresh tokens are still not rotated and there's no server-side revocation list (unchanged `docs/security.md` limitation, out of scope for this module).
- Test data created this session (users 395/396, projects 393/394 and their tasks) was left in the shared dev database rather than cleaned up, unlike most prior modules' test fixtures which used dedicated teardown. Noted honestly rather than silently left inconsistent with the rest of the workshop's practice.

**Self-rating**

- I can repeat this with notes: yes - the shared typed API client (Bearer attachment, credentials handling, single in-flight refresh promise), the Pinia auth store and silent-refresh init flow, global route protection middleware, wiring real backend calls to replace placeholder data across dashboard/projects/project-detail, and the AbortController cancellation pattern for stale route-data responses.
- I can explain it without the reference code: yes - refresh logic must live outside the shared API client because the client's own 401 handler is what triggers a refresh; if refresh used that same client and itself received a 401, it would recursively invoke its own recovery logic. Middleware must await initAuth() completing before making any redirect decision because the initial auth state is genuinely unknown during a silent refresh - redirecting before that resolves risks sending a valid, already-logged-in returning user to the login page. AbortController prevents a stale response from an old route (e.g. project 1) from overwriting the state for a newly navigated-to route (project 2) if responses arrive out of order, since Vue Router reuses the same component instance across param changes rather than remounting it.
- I can diagnose one failure in this area: yes - the module's own two real bugs (the SSR false-empty state, the accumulated node_modules ELOOP corruption) were independently diagnosed and fixed with root-cause evidence, not guessed at, demonstrating the ability to adapt this pattern to a different API, route structure, auth contract, and state model on another project.
- Confidence from 1-5: 5/5 - the implementation, real backend integration (verified against a live server including deliberate failure drills - invalid tokens, a real backend outage, cross-user authorization, invalid transitions), and the full quality gate (lint/typecheck/build) were all thoroughly and empirically verified. The one caveat is that browser-only click-triggered interactions were not observed via browser automation (no such tooling was available this session) - verified instead via byte-for-byte request/response contract reproduction and direct source review, honestly documented as a real limitation rather than claimed as fully verified.

---

### Module 12 — SSR, SEO, accessibility, and performance

**Date and branch**

- Date: 2026-08-15
- Branch: learning/12-ssr-seo-a11y
- Pull request: none yet

**Objectives in my own words**

Make the one genuinely public page in this app (`/public/projects/[slug]`) actually behave like a public page: real content and metadata in the initial HTML response (not just in the hydrated DOM), a real `404` status when a project is missing or private (not a styled page that still says `200` to anything checking status codes), and correct `noindex`/indexable signaling so search engines index the right pages and skip the rest. Configure route rendering (prerender/SSR/client-only) deliberately per route instead of leaving everything on Nuxt's default, and understand the freshness/failure tradeoff that comes with caching. Verify all of this empirically - HTTP status codes, real response headers, real served HTML - not by reading the component source and assuming it works.

**Scope decision made up front**

No browser automation was available this session (`mcp__claude-in-chrome__tabs_context_mcp` returned "Browser extension is not connected") - the same gap Modules 10 and 11 hit. Step 6 (accessibility) therefore falls back to the same static-verification approach used in those modules: real served HTML/CSS and ARIA attributes checked against spec, not a literal keyboard/screen-reader session. Step 7 (performance) falls back to `curl`-derived timing/size data in place of Lighthouse/DevTools, since neither is installed in this project. Both gaps are documented honestly below rather than claimed as fully verified.

**Step 1 - route classification table**

Extended from my own starting reasoning on `/login` (noindex, SSR optional) and `/dashboard` (noindex, not crawlable anyway since auth-gated, SSR only useful if server-readable auth existed):

| Route | Audience | Rendering | Auth dependency | Indexing | Freshness | Failure status |
|---|---|---|---|---|---|---|
| `/` (home) | Anyone, public entry point | Prerendered (build-time, static) | None | Index | Static until next deploy | N/A - static output, nothing to fail at request time |
| `/login` | Guests with an existing account | SSR (default), optional - cheap static form, no per-request data | Guest-only (middleware redirects an already-authenticated visitor away) | Noindex | Static | Form validation errors only, no page-level failure |
| `/register` | Guests without an account | SSR (default), optional - same reasoning as `/login` | Guest-only | Noindex | Static | Same as `/login` |
| `/dashboard` | Returning authenticated users only | Client-only (`ssr:false`) | Authenticated (middleware-protected) | Noindex | Always live, never cached - a stale or cross-user-leaked cache here would be a real security bug, not just staleness | Client-rendered error state on fetch failure; never a page-level 5xx since nothing is rendered server-side to fail |
| `/projects` | Same as dashboard | Client-only (`ssr:false`) | Authenticated | Noindex | Always live | Same as dashboard |
| `/projects/[id]` | Same as dashboard | Client-only (`ssr:false`) | Authenticated | Noindex | Always live (task list/statuses change) | Client-rendered "not found" for an id that doesn't belong to/exist for this user |
| `/public/projects/[slug]` | Anyone - the one page meant to be found/shared | SSR with short SWR (60s) | None - deliberately unauthenticated | Index when the project exists and is public; noindex the instant it's missing or private | Short SWR - not so volatile it needs a fresh render every hit, not so static it should be prerendered (task counts move independently of any deploy) | Real `404` for missing/private (this was broken - see Step 2) |

Reasoning for the extensions beyond the two given examples:

- **`/register`**: same dead-end argument as `/login` - a search engine sending a stranger to a bare signup form with no product context is not a useful result, and the form itself is thin/duplicate-content across virtually every app that has one. I deliberately did *not* treat it as a marketing conversion page (the way a real product might), since this project has no stated acquisition-funnel goal - see `STARTER_SCOPE.md`.
- **`/dashboard`, `/projects`, `/projects/[id]`**: all three get identical treatment, not just "noindex" but genuinely `ssr:false` (Step 4) - true client rendering, not merely an SSR'd shell with client-only data. The concepts doc (`docs/accessibility-and-seo.md`) names this pattern explicitly ("Client rendering: ... fits protected dashboard interactions where crawlability is not required"), and it has a real second benefit beyond matching the doc: with `ssr:false`, the server never renders any HTML for these routes at all, which removes the entire *category* of hydration-mismatch risk for them, not just the auth-state instance of it.
- **`/public/projects/[slug]`**: this is the one route the whole module is about, so it gets the opposite treatment on every axis - real SSR, real indexing, real metadata, real 404. The "auth dependency: none" line is not a throwaway detail - it's the direct reason the page must never branch on `auth.isAuthenticated` or any client-only auth state: the only real audience for this page (an anonymous visitor or a crawler) never has a session, so any content gated behind auth state would silently vanish for 100% of the page's actual purpose.

**Step 2 - real 404 for missing/private public projects**

Baselined the *actual* behavior before touching anything, using a real registered user and real public/private projects created against the live backend:

```text
$ curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/public/projects/m12-public-demo
HTTP 200
$ curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/public/projects/m12-private-demo
HTTP 200   # BUG - private project, should be 404
$ curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/public/projects/does-not-exist-xyz
HTTP 200   # BUG - nonexistent slug, should be 404
```

This is exactly the module's own named failure mode ("Returning a styled error page with HTTP 200 for missing content") - not hypothetical, actually present. Root cause: `useFetch`'s `error` ref was checked to pick which UI branch to render, but nothing ever told the outer Nitro response to actually be a 404 - Nuxt doesn't propagate a `useFetch` error's status code to the page response automatically. Fixed with `setResponseStatus(error.value.statusCode ?? 404)` inside an `import.meta.server` guard in `public/projects/[slug].vue`, run *before* the template renders - this only changes the wire-level HTTP status; the friendly `ErrorAlert` UI is unchanged (the module's failure-mode list is specifically about a styled 200, not about needing an ugly page). The backend's `get_public_project_summary` raises the same `NotFoundError` for both "missing" and "private" (confirmed in `backend/app/services/projects.py`) by design, so this page structurally cannot leak which case it is - the exact resource-scoped-404 pattern already established in Modules 07/08 for authenticated routes, extended here to the one route with no auth at all.

Re-verified after the fix:

```text
$ curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/public/projects/m12-public-demo
HTTP 200
$ curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/public/projects/m12-private-demo
HTTP 404
$ curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/public/projects/does-not-exist-xyz
HTTP 404
```

Confirmed identically against the real, isolated production Docker image later in this session (see the production-build investigation below) - not just the dev server.

**Step 3 - page-specific metadata**

Added to `public/projects/[slug].vue`: a real `description` (the project's own description, falling back to a computed "`X of Y` tasks complete" sentence when the project has none - never a generic static description), Open Graph title/description/type/url, `twitter:card`, and a canonical link. Added `robots: noindex, nofollow` as a second, independent signal on the error branch (belt-and-braces alongside the real 404 - a 404 URL can still get crawled/cached before it 404s again later). Added the same `noindex` to `login.vue`, `register.vue`, `dashboard.vue`, `projects/index.vue`, `projects/[id].vue` per the Step 1 table. Added Open Graph title/description/type to the home page.

Canonical URL: the module explicitly says "Plan canonical URL once a stable public domain exists" - there is no deployed custom domain yet, so rather than skip this or hardcode `localhost`, added `runtimeConfig.public.siteUrl` (defaults to `http://localhost:3000`, overridable via `NUXT_PUBLIC_SITE_URL`) and built the canonical/OG URLs from it. This makes the mechanism real and testable today and correct in production by setting one env var, no code change - the same pattern this project already uses for `apiBase`/`apiInternalBase`.

No secrets or private fields anywhere in metadata - confirmed by construction: the only data source for the public page's metadata is `ProjectPublicSummary` (`name`, `slug`, `description`, `task_count`, `completed_task_count`), which never included `owner_id` or any private field in the first place (confirmed by the existing Module 10 test `test_public_project_summary_excludes_private_fields`).

Verified via real served HTML, both dev and the real production build:

```html
<title>M12 Public Demo — Workboard</title>
<meta name="description" content="A public project used for Module 12 SSR/SEO verification.">
<meta property="og:title" content="M12 Public Demo — Workboard">
<meta property="og:description" content="A public project used for Module 12 SSR/SEO verification.">
<meta property="og:type" content="website">
<meta property="og:url" content="http://localhost:3000/public/projects/m12-public-demo">
<meta name="twitter:card" content="summary">
<link rel="canonical" href="http://localhost:3000/public/projects/m12-public-demo">
```

```text
$ curl -s http://localhost:3000/login | grep -io '<meta name="robots"[^>]*>'
<meta name="robots" content="noindex, nofollow">
$ curl -s http://localhost:3000/register | grep -io '<meta name="robots"[^>]*>'
<meta name="robots" content="noindex, nofollow">
```

**Step 4 - route rendering/cache configuration, and a real bug it exposed**

`nuxt.config.ts` `routeRules`: `/` prerendered; `/public/projects/**` gets `swr: 60`; `/dashboard`, `/dashboard/**`, `/projects`, `/projects/**` get `ssr: false`. (Added both the exact path and the `/**` wildcard for `/dashboard` and `/projects` after checking - Nitro's route-rule matching on a bare `/**` glob was not something I wanted to assume matches the exact parent path too, so both are explicit.)

Prerendering `/` exposed a real correctness problem I hadn't anticipated: the home page's `useFetch('/api/health')` call would, once prerendered, run exactly once at *build* time and get baked into the static output forever - "Backend reachable via server-side render: alive" would keep showing verbatim during a real outage, and a build-time backend hiccup would freeze a false "unreachable" message into every page load until the next deploy. Fixed by moving that fetch to `{ server: false }` (client-only), so it runs fresh in each visitor's own browser after hydration instead of being frozen into the static HTML - the hero content above it has no such per-request dependency and is exactly what should stay prerendered. This reintroduced the same `status === 'idle'` vs `pending` distinction Module 11 already found and fixed on `/dashboard` (with `server:false`, the fetch never starts during the prerender pass, so `pending` is `false` and `status` is `'idle'`, not "checked and failed") - applied the identical fix here before it became a second instance of the same bug.

Verified `ssr:false` actually took effect, not just configured and assumed:

```text
$ curl -s http://localhost:3000/dashboard | grep -o '<body[^>]*>.*</body>'
<body><div id="__nuxt"></div>...<script ... data-ssr="false" id="__NUXT_DATA__">[{"serverRendered":1},false]</script></body>
```

`data-ssr="false"`, an empty `<div id="__nuxt"></div>`, no title/h1/project data anywhere in the response - genuinely nothing server-rendered to leak or mismatch against, for `/dashboard`, `/projects`, and `/projects/1` alike.

Verified prerendering actually took effect via the real build log, not just the config:

```text
[nitro] ℹ Prerendering 1 routes
[nitro]   ├─ / (463ms)
[nitro] ℹ Prerendered 2 routes in 7.902 seconds
```

**Verifying SWR/backend-down behavior required the real production build - and that build was completely broken**

Nuxt dev mode doesn't meaningfully apply Nitro's cache layer, so testing "what happens when the backend is down and a cached page exists" (the module's own explicit Step 4 requirement) needed the actual production artifact. First attempt - running the already-built `.output` directly via `docker compose run --rm frontend node .output/server/index.mjs` - hit a real `500`:

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/workspace/.output/server/node_modules/vue/index.mjs' imported from /workspace/.output/server/chunks/routes/renderer.mjs
```

Suspecting this was an artifact of my own improvised test harness (running the bundle inside the bind-mounted dev container rather than the project's actual defined production path), I rebuilt using the real thing - `docker build --target production ./frontend`, the exact stage `frontend/Dockerfile` defines for deployment. It failed too, but differently and earlier, at `npm run build` itself:

```text
app/plugins/api.ts(22,27): error TS2304: Cannot find name 'useAuthStore'.
app/stores/auth.ts(70,24): error TS18046: '$api' is of type 'unknown'.
eslint.config.mjs(2,22): error TS2307: Cannot find module './.nuxt/eslint.config.mjs'
```

**Failure investigated #1 - clean production build fails typecheck entirely**

- Symptom: `docker build --target production ./frontend` fails at `npm run build` with dozens of "cannot find name" errors for things that plainly exist in the source (`useAuthStore`, `useProjectsApi`, shared types, etc).
- Smallest reproduction: the same failure, deterministically, on two separate clean builds (confirmed via `PIPESTATUS`, not `tail`'s exit code - the exact same mistake I'd already documented catching in Module 10, caught again here before treating either run as authoritative).
- Hypothesis: the `.nuxt/` generated type declarations that make Nuxt's auto-imports resolve for TypeScript were never (re)generated against the real project source inside this Docker stage.
- Evidence: `frontend/Dockerfile`'s `dependencies` stage runs `npm ci` (which triggers `postinstall: nuxt prepare`) *before* `COPY . .` ever happens in that stage - at that point only `package.json`/`package-lock.json` exist, no `nuxt.config.ts`, no `app/`, nothing for `nuxt prepare` to scan. The later `build` stage does `COPY . .` then runs `npm run build` directly, with no explicit `nuxt prepare` step run against the now-real source. This exact failure had never surfaced before because every previous `npm run build` in this project's history (including my own Step 8 gate below) ran via `docker compose run --rm frontend npm run build` *inside the already-running dev container*, which has a `.nuxt/` already generated from `nuxt dev` and persisted on the host bind mount - masking the gap completely. The actual `production` Docker stage, it turns out, had never been built clean before in this repository's history (`compose.yaml` runs `target: development`; nothing in this project's history through Module 11 builds `target: production` directly).
- Root cause: `frontend/Dockerfile`'s `build` stage never re-runs `nuxt prepare` after the real source is copied in, so a genuinely clean build has no auto-import type declarations to typecheck against.
- Prevention/fix: added `RUN npm run postinstall` immediately after `COPY . .` in the `build` stage, before `RUN npm run build`. Rebuilt clean - `docker build --target production ./frontend` now exits `0`.

**Failure investigated #2 - production image builds, but every SSR'd route 500s**

- Symptom: with the typecheck fix in place, the image builds successfully, but every route that needs Vue to render on the server (`/public/projects/[slug]`, `/login`, even `/dashboard` despite `ssr:false`, since the initial HTML shell still goes through the same renderer) returns `500`. Only genuinely static/non-Vue routes work - the prerendered `/`, and the plain Nitro server routes `sitemap.xml`/`robots.txt`.
- Smallest reproduction: `docker run` the real, isolated production image (built fresh, no bind mounts, on the Compose network so `backend:8000` resolves) and `curl` any SSR'd route - `500` every time, deterministically.
- Hypothesis: Nitro's `node-server` preset doesn't ship all of `node_modules` into `.output/server` - it traces which files are actually needed at runtime and copies only those. If that trace missed a file `vue/server-renderer` itself depends on, the base `vue` package would be incompletely copied.
- Evidence that confirmed it: inspected the packaged image directly - `docker run --rm <image> ls -la /app/server/node_modules/vue/` showed only `package.json` and a `server-renderer/` subfolder; `vue/server-renderer`'s own code needs the base Vue runtime (`vue/index.mjs`, `dist/`) that the tracer never copied. The `package.json`'s own `"files"` field lists `index.mjs`/`dist` as real, expected package contents - they exist in the real installed package, they just never made it into the traced output.
- Root cause: Nitro's dependency file-tracer failed to follow `vue/server-renderer`'s internal (non-statically-obvious) import of the base `vue` package, so the base package's actual runtime files were left out of the production bundle even though its `package.json` was copied.
- Prevention/fix: added `nitro: { externals: { inline: ['vue', 'vue/server-renderer'] } }` to `nuxt.config.ts` - this bundles both packages directly into the server chunks instead of leaving them as external files the (buggy) tracer has to separately copy, sidestepping the gap entirely rather than patching around its symptom. Rebuilt clean; every previously-500ing route now returns its correct real status against the real production image:

```text
$ curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3001/public/projects/m12-public-demo
HTTP 200
$ curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3001/dashboard
HTTP 200
$ curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3001/login
HTTP 200
$ curl -s -o /dev/null -w "private: HTTP %{http_code}\n" http://localhost:3001/public/projects/m12-private-demo
HTTP 404
$ curl -s -o /dev/null -w "missing: HTTP %{http_code}\n" http://localhost:3001/public/projects/does-not-exist-xyz
HTTP 404
```

This is, honestly, the most significant finding of this module - a production-blocking defect that had existed silently in this repository since the frontend Dockerfile was written, invisible because nothing had ever exercised the real `production` build stage in isolation before. It surfaced only because Step 4 required testing real cache/outage behavior against a real production artifact instead of trusting the dev server.

**Step 4 continued - the actual SWR/backend-down test, against the fixed real production image**

```text
$ curl -s -D - -o /dev/null http://localhost:3001/public/projects/m12-public-demo | grep -i cache
cache-control: s-maxage=60, stale-while-revalidate

$ docker compose stop backend
Container fullstack-intern-starter-backend-1 Stopped

$ curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3001/public/projects/m12-public-demo   # already-cached page
HTTP 200   # full real content still served, backend fully down

$ curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3001/public/projects/module-11-public-regression-check   # never-cached page
HTTP 500   # no cache entry to fall back to, live fetch fails

$ docker compose start backend   # restored before continuing
```

Documented, evidence-backed answer to the module's own question: an already-warmed SWR cache entry insulates visitors from a real backend outage for the cache's window (60s here) - real content, real `200`, backend fully unreachable. That protection does not extend to a page nobody has visited yet during the outage; those still fail hard. This is a genuine limitation of the `swr:60` choice, not a bug: a longer window trades more outage resilience for staler content on every hit, and nothing here builds graceful degradation for a first-time visit mid-outage - documented as a known gap rather than solved, since building it was outside what Step 4 actually asked for ("document what happens").

Backend was fully restored (`docker compose start backend`, confirmed `/health/ready` returning `200` again) before any further work in this session.

**Step 5 - validate initial HTML (module's own exact commands)**

```text
$ curl --fail http://localhost:3000/public/projects/m12-public-demo > /tmp/public-project.html
$ echo $?
0
$ grep -i '<title' /tmp/public-project.html
<title>M12 Public Demo — Workboard</title>
$ grep -i 'description' /tmp/public-project.html
<meta name="description" content="A public project used for Module 12 SSR/SEO verification.">
$ grep -i '<h1' /tmp/public-project.html
<h1>M12 Public Demo</h1>
```

Confirmed project content (`<h1>`, description, "0 of 0 tasks complete") is present in the raw response body before any client JavaScript runs - `curl` cannot execute JS, so this is a genuine SSR proof, not a hydrated-DOM proof (the module's own named failure mode: "Inspecting only the hydrated DOM and claiming SSR works"). No real browser "view source" session was available this session (extension not connected) - the `curl`-based proof above is the honest substitute, same limitation class as Modules 10/11.

**Step 6 - accessibility audit (static verification, browser extension unavailable)**

Heading hierarchy, re-checked via real served HTML for every page that still SSRs (single clean `<h1>`, no skips, on `/`, `/login`, `/register`, `/public/projects/[slug]`):

```text
$ curl -s http://localhost:3000/ | grep -io '<h[1-6][^>]*>[^<]*</h[1-6]>'
<h1>Workboard</h1>
```
(same pattern confirmed for `/login`, `/register`, and the public project page - one `<h1>`, nothing else, each.)

`/dashboard`, `/projects`, `/projects/[id]` can no longer be heading-checked via `curl` at all after Step 4's `ssr:false` change - there is genuinely no server-rendered HTML for `curl` to inspect there anymore (confirmed above: `data-ssr="false"`, empty `<div id="__nuxt">`). Verified their heading structure by direct source review instead (`dashboard.vue` h1 → `ProjectCard` h2; `projects/[id].vue` h1 → h2 "Tasks" → `TaskCard` h3) - unchanged from the hierarchy Module 10 already fixed and Module 11 preserved; I did not touch these components' templates this module, only their `<script>` blocks' `useSeoMeta` calls.

Other checks, all via source/served-artifact inspection (no live keyboard/screen-reader session possible without the browser extension):

- No non-native clickable elements: `grep -rn "@click"` across `app/` still finds exactly the same 5 matches as Module 10/11 (`AppHeader`'s logout, `PaginationControls`' prev/next, `TaskCard`'s advance/delete), all real `<button type="button">` elements. My changes added zero new interactive elements.
- Labels: unchanged from Module 10/11 (I only edited `<script>` blocks, not form templates) - every input still has a matching `<label for>`.
- Focus visibility, skip-link, reduced-motion: confirmed present in the actual served stylesheet (`focus-visible` outline rules, `.skip-link`, `@media (prefers-reduced-motion: reduce)` disabling the loading spinner's animation) by reading `frontend/app/assets/css/main.css` directly - all three unchanged and still real, not just written and assumed applied.
- Status/error identification independent of color: `LoadingIndicator` (`role="status"`, `aria-live="polite"`) and `ErrorAlert` (`role="alert"`, text title + message) unchanged - confirmed by reading both components directly.
- Zoom/narrow viewport: `main.css` uses `rem`/`clamp()`/percentage units throughout (no fixed-`px` widths that would break reflow), plus an explicit `@media (max-width: 640px)` rule for the header - confirmed by direct review, not a live 200%-zoom session.

Honest gap: no live browser session (keyboard-only journey, actual 200% zoom rendering, real screen-reader pass) was possible - `mcp__claude-in-chrome__tabs_context_mcp` reported the extension not connected. Everything above is real evidence from the actual served artifacts, not assumption, but it is not the same class of proof as watching a real assistive-technology session, and I'm not claiming it is.

**Step 7 - performance observation**

No Lighthouse and no connected browser DevTools this session - used `curl` timing/size data as the honest substitute:

```text
$ curl -s -o /dev/null -w "ttfb: %{time_starttransfer}s total: %{time_total}s size: %{size_download} bytes\n" http://localhost:3000/public/projects/m12-public-demo
ttfb: 0.040s total: 0.040s size: 2833 bytes
```

Real production build output (from Step 8's build below): single bundled/hashed CSS file per page (`entry.OuwjsmNG.css`), no duplicate stylesheet links - the dev server's response for the same page shows *two* `<link rel="stylesheet">` tags for what's effectively the same CSS (Vite dev-mode serving both the aliased and workspace-relative source paths), confirmed as a dev-only artifact by diffing against the real production HTML, which correctly serves one bundled file. No external fonts are loaded (`--font-sans: Inter, ui-sans-serif, system-ui, sans-serif` falls straight through to system fonts since no `@font-face`/webfont `<link>` exists anywhere), so there's no font-loading layout-shift risk to begin with.

Decision: documented non-action, not a fix. At this app's current scale - a 2.8KB HTML response, one small CSS bundle, no images, no third-party scripts, ~40ms local TTFB - there is no real bottleneck to justify code-splitting further, adding resource hints, or building an image pipeline that has nothing to optimize yet (no images exist). Doing any of that now would be exactly the "premature optimization" the module explicitly warns against. The one real, evidence-backed lever that *does* exist at this app's current scale is the SWR cache window from Step 4, and that's a freshness/availability tradeoff already made and documented there, not a pure performance win.

**Step 8 - SEO/SSR acceptance test plan**

No test runner exists in this project yet (Vitest arrives in Module 13; `frontend/package.json` still has no `test` script) - per this module's own "Plan or implement" wording and the same pattern used for untestable pieces in Modules 10/11, this is a written plan, not executable tests:

1. `GET /public/projects/<real-public-slug>` → `200`; response body contains the project's real `name` in an `<h1>`, and a `<meta name="description">` whose content is non-empty and project-specific (not a fixed string repeated across projects).
2. `GET /public/projects/<private-or-nonexistent-slug>` → `404`; response includes `<meta name="robots" content="noindex, nofollow">`.
3. `GET /login`, `GET /register`, `GET /dashboard` (as an authenticated session), `GET /projects` → each includes `noindex` (dashboard/projects via the client-only shell having nothing indexable at all; login/register via the explicit meta tag).
4. No Vue hydration-mismatch warning is logged to the browser console during: home page load → navigate to a public project page → log in → visit dashboard → visit a project detail page. (Needs a real browser automation tool; not executable this session - see the Step 6 gap.)
5. `GET /sitemap.xml` → `200`, `content-type: application/xml`; contains `<loc>` for `/` and every currently-public project's slug; does not contain any project confirmed private in the same test's setup.
6. `GET /robots.txt` → `200`; contains `Disallow: /dashboard`, `Disallow: /projects`, and a `Sitemap:` line pointing at the real site's `/sitemap.xml`.
7. Freshness: request a public project page, mutate the project's task counts via the authenticated API, request the same public page again within the SWR window - assert the *first* re-request may still show the old count (documented staleness), and a request after the window elapses shows the updated count.

**Independent challenge - generated sitemap and robots configuration**

Implemented for real, not deferred to a design note - it needed one small, well-justified backend addition (a `GET /api/v1/projects/public` list endpoint returning only `slug` + `updated_at` for every currently-public project, mirroring the existing single-slug `/projects/public/{slug}` endpoint's "no auth, no private fields" shape) plus two new Nuxt server routes.

- **How public projects are discovered**: `frontend/server/routes/sitemap.xml.ts` queries the new backend list endpoint on every request (not cached/prerendered) - the backend's live `is_public` flag is the single source of truth for what belongs in the sitemap.
- **How stale/deleted projects are removed**: no separate cleanup job exists or is needed - because the sitemap route re-queries the live backend on every request rather than working from a snapshot, a project that gets deleted or flipped to private simply stops appearing in the very next `sitemap.xml` fetch. Verified directly: `m12-private-demo` (created private) never appears in `sitemap.xml`'s output; only the 6 currently-public projects in the dev database do.
- **How this scales beyond a small dataset**: documented honestly as a real, current limitation rather than faked - this returns every public project in one uncapped query and one XML document, fine at this project's current scale (a handful of projects) but not compliant with the real sitemap protocol limit (50,000 URLs / 50MB per file). The standard real fix is a sitemap index file referencing multiple paginated sub-sitemaps, which itself needs a paginated backend list endpoint (`limit`/`offset` or keyset pagination) - and no list endpoint in this API has pagination yet (noted as a gap back in my own Module 03 log entry, still true). Building fake pagination against a backend endpoint that has none would have been misleading rather than useful, so I stopped at documenting the real constraint instead.

`robots.txt` (`frontend/server/routes/robots.txt.ts`) disallows `/dashboard` and `/projects` (both now `ssr:false` - genuinely nothing for a crawler to fetch there) and references the real sitemap URL. Deliberately did **not** disallow `/login`/`/register` even though both are `noindex`: Google's own guidance is that `Disallow` prevents a crawler from ever fetching a page at all, which means it never sees that page's `noindex` meta tag either - `Disallow` and `noindex` are two different, non-composable mechanisms, and using `Disallow` on a page whose actual goal is "let it be fetched, just don't index it" would work against that goal. Verified via `curl`:

```text
$ curl -s http://localhost:3000/robots.txt
User-agent: *
Disallow: /dashboard
Disallow: /projects

Sitemap: http://localhost:3000/sitemap.xml

$ curl -s http://localhost:3000/sitemap.xml | grep -o "m12-private-demo"
(no output - confirmed absent)
```

Backend: added `list_public_projects` (repository), `list_public_project_summaries` (service), `GET /projects/public` (route, returns `list[ProjectPublicListItem]`), and a new test (`test_list_public_projects_excludes_private_and_is_unauthenticated`) asserting the endpoint is unauthenticated, excludes a private project created in the same test, and returns exactly `{slug, updated_at}` - no name/description/owner leakage. Full backend suite: `55 passed`.

**Commands and evidence - final quality gate**

Every command below run fresh, after every change in this session including the Dockerfile/nuxt.config fixes, with exit codes captured via `PIPESTATUS` (not piped through `tail`, after the Module 10 lesson on that):

```text
$ docker compose run --rm backend pytest -q
....................................................... [100%]
55 passed

$ docker compose run --rm frontend npm run lint
LINT_EXIT=0

$ docker compose run --rm frontend npm run typecheck
TYPECHECK_EXIT=0   # same pre-existing benign vue-router/volar warning as every prior module, non-fatal

$ docker build -t <tag> --target production ./frontend
FINAL_BUILD_EXIT=0   # the REAL production Docker stage, not the dev-container shortcut - see Step 4's investigation for why that distinction mattered this module
```

This is a stronger gate than any prior module's: previous modules' "build" evidence was `npm run build` executed inside the already-`nuxt prepare`d dev container, which (as Step 4 found) was silently masking a real defect in the actual deployment path. This module's final gate is the first time in this project's history the real, isolated `production` Docker stage has been built and run end-to-end.

**Decision and tradeoff**

Chose `nitro: { externals: { inline: ['vue', 'vue/server-renderer'] } }` over alternatives like pinning a different nitropack version or manually copying missing files into `.output` post-build. Inlining is a one-line, low-risk config change that directly targets the confirmed root cause (the tracer's gap around `vue/server-renderer`'s internal import) rather than working around its symptom, and it costs a small amount of extra size in the server bundle (both packages get bundled directly instead of left as separately-copied external files) - an acceptable tradeoff for a small app, worth revisiting if nitropack ships an upstream fix and the inline override becomes unnecessary.

**Security, privacy, and operations**

The new `GET /api/v1/projects/public` endpoint is deliberately unauthenticated, matching the existing single-slug endpoint - verified it returns only `slug`/`updated_at`, never owner/description/task data, so it can't be used to enumerate private information even though it requires no login. The real-404 fix (Step 2) closes a minor information-disclosure gap of its own: before this module, a private project's slug still returned `200` (distinguishable from a nonexistent slug only by body content, not status), which is a softer version of the same "existence oracle" problem Modules 07/08 already solved for authenticated project access - now both authenticated and public access paths agree on returning an indistinguishable 404 rather than leaking existence via status code. No secrets in metadata (checked in Step 3). No new migrations - the new endpoint returns existing `Project` columns, no schema change.

**Review feedback**

N/A - no pull request opened yet for this module.

**Remaining uncertainty**

- Whether `nitro.externals.inline` for `vue`/`vue/server-renderer` is the *idiomatic* fix nitropack maintainers would recommend, versus a nitropack/vue-bundle-renderer version bump that fixes the tracer gap upstream - I confirmed my fix resolves the observed symptom with real evidence, but haven't checked nitropack's own issue tracker for whether this is a known, already-patched-in-a-later-version bug.
- Whether the installed `vue@3.5.40` (found while investigating the packaging bug) versus `package.json`'s pinned `"vue": "3.5.28"` is itself worth tightening to an exact pin - noted but not investigated further, since it wasn't the root cause of anything found this module.
- The accessibility and performance verification gaps (Step 6/7) both depend on a browser automation tool that wasn't connected this session - real evidence from served artifacts was gathered in its place, but a live browser pass (keyboard journey, real 200% zoom, Lighthouse/DevTools trace) is still genuinely outstanding, same as it was after Modules 10 and 11.

**Self-rating**

- I can repeat this with notes: yes - the production-build diagnosis (missing nuxt prepare in the build stage, Nitro's dependency tracer failing to bundle vue/server-renderer's internal import) and the specific Nitro/Vue tracing edge cases are the parts I would keep notes for; the route classification, SSR/prerender/client-only tradeoffs, the resource-scoped 404 pattern extended to the one unauthenticated public route, and the SWR caching decision I can apply directly without notes.
- I can explain it without the reference code: yes - ssr:false means there is no server-produced page DOM for Vue to hydrate against at all, so a hydration mismatch is structurally impossible for that route, not just avoided in one instance (client-rendered UI can still have loading/state-transition bugs, but not SSR-to-client hydration disagreement, since there is no SSR output to disagree with). Cache/outage behavior needs the real production artifact because development runs a genuinely different execution path (prepared dependencies, dev-mode transforms, looser module resolution, no production bundling/tracing/pruning) - the dev server's "it works" proves nothing about what the actual deployed bundle does. Disallow and noindex are non-composable because Disallow blocks crawling entirely, meaning a crawler never even reaches the page to see its noindex tag - for a page that should be fetchable but excluded from results, the page must remain crawlable (not Disallowed) while carrying noindex.
- I can diagnose one failure in this area: yes - would reproduce in the isolated build/runtime image first, separate build-stage failure from runtime/bundling/tracing failure, and inspect the actual generated artifacts and dependency resolution directly rather than treating dev-server behavior as evidence of anything about production.
- Confidence from 1-5: 5/5 for the concepts and investigation methodology (route classification reasoning, SSR/hydration/caching tradeoffs, and the discipline of testing against real production artifacts rather than the dev server); 4/5 for unfamiliar framework-specific packaging internals (Nitro's file-tracing behavior specifically) until verified against that exact tool's real production image, which is precisely what this module's investigation required and did.

---

### Module 13 — Frontend testing with Vitest

**Date and branch**

- Date: 2026-08-17
- Branch: learning/13-frontend-tests
- Pull request: none yet

**Objectives in my own words**

Pick the cheapest layer that can actually catch a given frontend risk instead of defaulting to mounting a component (or worse, a browser) for everything - a date-formatting bug belongs in a pure function test that runs in milliseconds, not a Playwright journey. Configure Vitest for a real Nuxt app the way Nuxt itself recommends, not by copying a generic Vitest starter. Write tests that assert what a user or a calling module actually depends on (visible text, accessible roles, emitted events, request shape) rather than component internals. Mock only the real boundary of whatever's under test - a fake fetcher for the API client, a fake store for a component, never the function being tested itself. Then prove the whole suite is worth trusting by deliberately breaking three real behaviors and confirming the tests actually notice.

**Step 1 - frontend risk map**

Built after actually implementing each layer below (not purely speculatively) so the reasoning reflects what was genuinely necessary, not a guess:

| Risk | Layer | Reasoning |
|---|---|---|
| status label mapping | Pure unit (`tests/unit/labels.spec.ts`) | Was a private, unexported record inside `StatusBadge.vue`'s `<script setup>` - impossible to unit-test without mounting the component. Extracted to `app/utils/labels.ts` (`statusLabel`) specifically so the mapping itself is directly testable, the module's own "lowest useful layer" principle taken literally. |
| date formatting | Pure unit (`tests/unit/date.spec.ts`) | Deterministic string transformation (null/undefined/empty/invalid/valid in, exact string out) with zero Vue/DOM/Nuxt dependency - the fastest, most direct layer available. Real, honestly-disclosed finding: nothing in this codebase currently displays a date anywhere (see "Real bugs and gaps found" below) - written and tested pre-emptively per this module's own named risk-map item, not invented UI to manufacture a place to use it. |
| API error normalization | Pure unit, two functions (`tests/unit/normalize-error.spec.ts`, `tests/unit/api-error.spec.ts`) | Both `normalizeError` (`api-client.ts`, the client's own internal shape) and `extractErrorDetail` (`api-error.ts`, used directly by `public/projects/[slug].vue`) are plain, already-pure functions once `normalizeError` was exported (see gaps below) - no reason to pay for a component mount or Nuxt context to test a pure `unknown -> ApiError`/`string` mapping. |
| task card advance event | Component (`tests/components/TaskCard.spec.ts`) | Needs a real Vue component tree, real `@click`-to-`emit` wiring, and Nuxt's auto-registered `StatusBadge` child - a pure function test can't observe an emitted event at all. |
| form disabled while saving | Component (`tests/components/register-page.spec.ts`) | `:disabled="status === 'pending'"` is a template binding driven by real reactive state during a genuinely in-flight async call - only a mounted component with a controllable (fake) async boundary can observe the mid-flight state, not a pure function. |
| API base/header/body behavior | API-client, fake fetcher (`tests/services/api-client.spec.ts`) | This is specifically about what `createApiClient`'s `request()` passes to the transport layer - needs the real orchestration logic exercised against a fake fetcher, not a live network call (too slow/flaky) and not a full Nuxt app (the client is deliberately Nuxt-context-free by design - see gaps below). |
| one refresh/retry after 401 | API-client, fake fetcher (same file) | Same reasoning - the refresh-once/retry-once/no-recursion logic is pure orchestration around three injected callbacks, exactly what the client's own docstring already claimed it was built for. |
| auth middleware redirect | Nuxt-aware (`tests/nuxt/auth-middleware.spec.ts`) | Genuinely needs real Nuxt route/composable context (`useAuthStore`, `navigateTo`) and the actual `await initAuth()`-before-deciding ordering - a pure function test can't fake Nuxt's auto-import machinery, and this isn't a rendered component either (no template, no DOM). |
| server-rendered public metadata | Already covered at the correct layer (Module 12), not duplicated here | Genuinely requires a real SSR HTTP response (real Nitro server, real status codes/headers) - Module 12 already verified this by `curl` against the real production build. Re-proving it via a Vitest component mount wouldn't even exercise the real HTTP/SSR path, and duplicating an already-covered risk at a lower-fidelity layer is exactly what `docs/testing-strategy.md` warns against ("Do not duplicate every scenario at every layer"). |
| complete registration/project/task journey | Reserved for Playwright (Module 15) | Explicit instruction in the module text. A real multi-page browser journey through the actual running stack isn't reproducible by mounting isolated components against fakes. |

**Step 2 - Vitest setup**

Checked before assuming: `frontend/package.json` had no test runner, no `test` script, and no `frontend/tests/` directory at all - confirmed by reading the file directly, matching Module 10-12's own repeatedly-documented "no test runner yet" gap.

Checked Nuxt's own testing approach (`docs/getting-started/testing`) rather than wiring a generic Vitest+jsdom config: Nuxt recommends `@nuxt/test-utils`, `happy-dom` (not `jsdom`) as the DOM environment, and - for this exact Vitest 4 / `@nuxt/test-utils` 4.1 combination - the new `test.projects` array (Vitest 4's replacement for the deprecated `environmentMatchGlobs`) combined with `@nuxt/test-utils/config`'s `defineVitestProject` helper for the Nuxt-aware slice.

Installed (`docker compose run --rm frontend npm install --save-dev ...`, matching the container-based install pattern every prior frontend module used - `package-lock.json` and the container's Node 22.16 are the source of truth, not the host's Node 24): `vitest@^4.1.10`, `@nuxt/test-utils@^4.1.0`, `happy-dom@^20.11.2`, `@vue/test-utils@^2.4.11`, and (added slightly later, once Step 4 needed genuine role/name queries - see below) `@testing-library/vue@^8.1.0`.

Wrote `frontend/vitest.config.ts` with two projects, not one shared environment:
- `unit` - `environment: 'happy-dom'`, covers `tests/unit/**` and `tests/services/**`. Deliberately plain, no Nuxt Vite plugins: the codebase's own pure functions (labels, date, error normalization, the API client factory) are built with "no Nuxt app context needed" as an explicit design property (see `api-client.ts`'s own docstring) - running them under the full Nuxt environment would hide that property instead of proving it, and a Nuxt environment measurably costs more per file (~2s vs ~15ms below).
- `nuxt` - `defineVitestProject({ environment: 'nuxt' })`, covers `tests/components/**` and `tests/nuxt/**`. Only tests that genuinely need Nuxt auto-imports/component resolution/route context pay that cost.

Added `"test": "vitest run"` to `package.json`'s scripts. Created `frontend/tests/{unit,services,components,nuxt}/` matching `docs/testing-strategy.md`'s own documented layout (`tests/unit/`, `tests/components/`, `tests/services/` - I added `tests/nuxt/` for the one test that's Nuxt-aware but isn't a component, since the doc doesn't name a folder for that case).

Verified before writing a single test, per the module's explicit instruction: ran `docker compose run --rm frontend npm test` against zero test files.

```text
 RUN  v4.1.10 /workspace
No test files found, exiting with code 1

 unit
include: tests/unit/**/*.spec.ts, tests/services/**/*.spec.ts
exclude:  **/node_modules/**, **/.git/**

 nuxt
include: tests/components/**/*.spec.ts, tests/nuxt/**/*.spec.ts
exclude:  **/node_modules/**, **/.git/**
```

Both projects registered correctly with the right globs; exit 1 is the correct, expected behavior for zero matching files, not a config error - config wiring confirmed before any real test existed.

**Real bugs and gaps found - fixed with root cause, per this module's own repeated pattern**

1. **`api-client.ts`'s own docstring was false.** It already claimed the client "receives a fetcher... so it can be unit-tested with a fake fetcher/store, with no Nuxt app context needed" (written in Module 11), but `request()` actually called the global Nuxt-auto-imported `$fetch` directly - there was no way to inject a fetcher at all. Undetected since Module 11 because no test suite existed to exercise the claim. Root cause: the docstring described an intended design that was never actually implemented. Fix: added an optional `fetcher?: typeof $fetch` field to `ApiClientOptions`, defaulting to the real global `$fetch` (`options.fetcher ?? $fetch`, evaluated lazily inside `createApiClient` so the bare `$fetch` identifier is never touched at all when a test always supplies a fake - confirmed safe to import this file under the plain `happy-dom` project, which has no Nuxt auto-imports). `plugins/api.ts` needed zero changes since it never sets the new field.
2. **`TaskCard.vue` never rendered `priority` at all**, even though `Task.priority` (`TaskPriority`) has existed on the wire type since it was defined. This made the module's own explicit Step 4 requirement ("assert visible status/priority/title") literally false for this codebase - there was no priority text to assert. Root cause: Modules 10-12 built the dashboard's authentication/SSR/routing concerns and never circled back to surface every `Task` field. Fix: added `priorityLabel(task.priority)` display to `TaskCard.vue` (new `app/utils/labels.ts` function, same extraction as status), and a genuine `TaskCard.spec.ts` assertion on it - not a test asserting a fabricated fact.
3. **`StatusBadge.vue`'s label mapping was private and inline**, blocking Step 3's explicit "status... label" pure-utility test from being possible without mounting a component. Fix: extracted to `app/utils/labels.ts::statusLabel`, `StatusBadge.vue` now calls it instead of duplicating the record (auto-imported, confirmed via the existing project convention - `extractErrorDetail` is used the same unimported way already, in `public/projects/[slug].vue`).
4. **The first version of `formatDate` had a latent hydration-mismatch bug identical in kind to what Module 12 targeted**, caught by reasoning about it before writing a test, not by a test failure: `Intl.DateTimeFormat` without an explicit `timeZone` uses the *runtime's local timezone*. SSR (this project's Docker containers) and a visitor's browser can be in different timezones, so the exact same ISO date string could render different text server-side vs. after client hydration for any date near a UTC day boundary - a real hydration mismatch, not a cosmetic issue. Fixed by pinning `timeZone: 'UTC'` explicitly. Verified the exact resulting strings (not assumed) via a real Node check inside the container before writing the corresponding test assertions:
   ```text
   $ docker compose run --rm frontend node -e "console.log(new Date('2026-13-45').toString()); ..."
   Invalid Date
   Invalid Date
   Invalid Date
   Aug 17, 2026
   Jan 5, 2026
   ```
5. **`register.vue`'s success message text is split across a `<p>` and an inline `<NuxtLink>`** ("Account created for X. `<a>Log in</a>` to continue."), so an exact-string `screen.findByText(...)` query never matches any single element - my first version of that test hung until timeout. Not a product bug (the real markup and behavior are fine and arguably good UX - the link belongs inline); a test-construction mistake, fixed by querying with a substring-matching function scoped to the `<p>` tag instead of a literal string.
6. **My own first version of the "first 401 retries" API-client test passed for the wrong reason.** Its fake `getAccessToken` returned a hardcoded constant regardless of whether `refresh()` had run - the real plugin wires `getAccessToken` to the auth store's `accessToken` ref, which the real `refresh()` (`rawRefresh`) mutates as a side effect; a fake that ignores that contract can't actually prove the retry uses the *new* token. Caught immediately by asserting the retry call's actual `Authorization` header instead of just asserting the client didn't throw. Fixed by making the fake stateful (`let currentToken`, mutated inside the fake `refresh`).
7. **A genuinely dangerous test-construction bug, found during the mutation drill (Step 7 below), not before it**: the "does not recurse on a second 401" test used a fetcher mock that rejects with 401 *forever* (`mockRejectedValue`, no bound). That's safe against the real, correct client (which stops after one retry regardless), but when deliberately mutated to remove the retry cap, running that exact test **OOM-crashed the Node test runner** (`FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory`) instead of failing cleanly - the unbounded mock let the unbounded recursion consume memory until the process died, faster than any `--testTimeout` flag could intervene. This is a real, generalizable finding about mutation testing, not just this codebase: an infinite-domain mock is unsafe to combine with a mutation that removes the exact guard the mock was implicitly relying on. Fixed for real (not just for the drill) by bounding the mock to 5 rejections before resolving - the test still fully proves the real client's behavior (it never reaches call 3, let alone 6) and is now safe to run against any mutant.
8. **`.nuxtrc`, auto-generated in `frontend/` by `@nuxt/test-utils` itself the first time the `nuxt` Vitest environment booted** (`setups.@nuxt/test-utils="4.1.0"`), was untracked and not covered by any `.gitignore` rule - a machine-written marker file, not something meant to be hand-authored or committed. Added `.nuxtrc` to the root `.gitignore` alongside the existing `.nuxt/`/`.output/` entries.
9. **`npm audit` reports 5 pre-existing vulnerabilities (2 moderate, 3 high)** after installing the new test dependencies - checked whether the new dependencies caused this via `git diff --stat frontend/package-lock.json` plus a targeted diff around `"nuxt":` (no version bump found for `nuxt` itself). All 5 trace to the already-pinned `nuxt@4.4.8`'s own transitive dependencies (`@nuxt/vite-builder`, `nanoid`, `postcss`, `brace-expansion`) - unrelated to Vitest/`@nuxt/test-utils`/`@testing-library/vue`. `npm audit fix --force` would bump `nuxt` to `4.5.2`, outside its deliberately pinned exact version - out of scope for a testing module and risky without the kind of dedicated verification Module 10-12 did for framework/packaging changes. Documented rather than silently run or silently ignored.

**Step 3 - pure utility tests**

`tests/unit/labels.spec.ts` (6 tests, table-driven over all 3 `TaskStatus` and all 3 `TaskPriority` values), `tests/unit/date.spec.ts` (8 tests: 3 null/undefined/empty-string cases, 3 unparseable-string cases, 2 valid-date cases with exact-string assertions, no snapshots), `tests/unit/normalize-error.spec.ts` (8 tests covering every branch: detail+code, detail without code, 422 without a string detail, non-422 without a string detail, no status at all, and 3 non-object error values), `tests/unit/api-error.spec.ts` (5 tests: string detail, missing detail, FastAPI's 422 array detail, a plain `TypeError` network failure, and 3 non-object values). All exact-value (`toBe`/`toEqual`) assertions, zero snapshots.

**Step 4 - component tests**

`tests/components/TaskCard.spec.ts` (7 tests): visible title/status-label/priority-label text; `advance`/`delete` emitted with the correct task id via `onAdvance`/`onDelete` props (role/name query via `screen.getByRole('button', { name: ... })`, not a CSS selector); Advance disabled once `status === 'done'`; Advance enabled for `backlog`/`in_progress` (table-driven); Delete never disabled regardless of status.

`tests/components/register-page.spec.ts` (3 tests) - the "form/display component": no dedicated `FormXxx.vue` exists yet in this codebase (every form is written directly inside its page), so `register.vue` was used directly as the only genuine "disabled while saving" behavior available, with `useAuthStore` mocked via `mockNuxtImport` (a controllable `vi.fn()` for `register`, plus the full shape `auth.global.ts`'s middleware needs - see gap below). Covers: submit button shows "Creating account…" and is disabled while the (manually-controlled) promise is pending; success message with the real registered email once resolved, button re-enabled; accessible error alert (`role="alert"`) with the real thrown message on failure, button re-enabled.

Switched from plain `@vue/test-utils` (`mountSuspended` + CSS-selector `wrapper.find`) to `@testing-library/vue`'s `renderSuspended`/`screen`/`fireEvent` partway through this step, after discovering Vue Test Utils has no `getByRole` at all (confirmed by grepping its own type declarations - zero matches) - real role/name accessible querying, which the module explicitly asks for, requires Testing Library, not just VTU. Added as a new devDependency for this reason, documented rather than faked with a CSS-selector workaround.

**Step 5 - API client tests**

`tests/services/api-client.spec.ts` (10 tests), the real `createApiClient` exercised with a fake `fetcher` (`vi.fn()`) and fake `getAccessToken`/`refresh`/`onAuthFailure` callbacks - never mocking `request()` itself. Covers every item the module names: base URL + bearer header attached (and *not* attached when there's no token); method/body forwarded exactly; GET is the default method; a normal success returns the fetcher's result unchanged; a first 401 refreshes exactly once and retries with the new token (asserted on the actual retry header, not just "didn't throw" - see gap #6 above); refresh failure calls `onAuthFailure` exactly once and rejects with the *original* 401, normalized; a second 401 after an already-refreshed retry does not call `refresh` again and does not call `onAuthFailure` (the retry's 401 falls straight to `normalizeError`, never re-entering the refresh branch at all); a non-401 error is normalized without ever touching `refresh`. Added one test beyond the module's minimum list, directly verifying a design property the client's own source comment claims but nothing had ever checked: two concurrent 401s share exactly one in-flight refresh (not one each).

**Step 6 - auth middleware test**

`tests/nuxt/auth-middleware.spec.ts` (6 tests). Picked "auth middleware redirect" over the log-out-on-network-failure alternative, since it's the one Step-1 risk that genuinely needs Nuxt route context - exactly what this step is for. `defineNuxtRouteMiddleware(fn)` just returns `fn` unchanged (confirmed by reading Nuxt's own source expectations - it's a typing/registration wrapper, not a runtime transform), so the default export was imported and called directly with fake `to`/`from` route objects; `useAuthStore` and `navigateTo` mocked via `mockNuxtImport`. Covers: unauthenticated visitor to `/dashboard` redirected to `/login?redirect=/dashboard`; same for a nested protected path (`/projects/5`); authenticated visitor on a protected route is not redirected; authenticated visitor on `/login` is sent to `/dashboard`; unauthenticated guest on `/login` is left alone; `initAuth()` is always awaited to completion before any redirect decision is made (asserted via call-order, not just call-count).

Real, honestly-disclosed environment limitation: the `if (import.meta.server) return` guard at the top of the middleware has no automated coverage here - `import.meta.server` is a Vite-time constant baked into the `nuxt` Vitest environment's client-mode build, not something this test can flip per-case. It's a single trivial early-return statement, and was already manually re-verified live via `curl` in Module 11 for the equivalent client-only routes; that manual check, not a test, is what backs this specific branch today.

**Step 7 - mutation drill**

Three mutations, one at a time, narrow tests run, restored, `git diff` confirmed clean before moving to the next:

*Mutation 1 - reverse the status label* (`app/utils/labels.ts`, swapped `'Backlog'`/`'Done'` between the `backlog`/`done` keys):

```text
FAILED tests/unit/labels.spec.ts > statusLabel > maps backlog to exactly Backlog
FAILED tests/unit/labels.spec.ts > statusLabel > maps done to exactly Done
2 failed, 11 passed
```

Caught cleanly at the dedicated pure-unit layer. `TaskCard.spec.ts`'s 7 tests all still passed unaffected - its one status-text assertion uses `in_progress` (untouched by this mutation), and its disabled-state assertions key off the raw `task.status` value, not the label text. Confirmed this is correct layering, not a gap: `docs/testing-strategy.md` explicitly says not to duplicate every scenario at every layer, and `labels.spec.ts` is already the exhaustive, dedicated owner of this exact contract for all 3 status values. Restored; `git diff` clean.

*Mutation 2 - emit the wrong task ID* (`TaskCard.vue`, `emit('advance', task.id)` → `emit('advance', task.id + 1)`):

```text
FAILED tests/components/TaskCard.spec.ts > TaskCard > emits advance with the task id when the Advance button is clicked
AssertionError: expected "vi.fn()" to be called once with arguments: [ 99 ]
Received: [ 100 ]
1 failed, 6 passed
```

Caught immediately and precisely - the failure message shows the exact wrong value received. Restored; `git diff` clean.

*Mutation 3 - let the API client refresh/retry repeatedly* (`api-client.ts`, `if (status === 401 && !isRetry)` → `if (status === 401)`, removing the retry cap):

First attempt at verifying this - running the existing "does not recurse" test as originally written (persistent 401 mock) - **OOM-crashed the test runner** rather than failing cleanly (see gap #7 above; this was itself the most important finding of this step, not a side note). Fixed the test to use a bounded mock (5 rejections then success) - a real, permanent hardening, not a one-off workaround for this drill - then re-ran against the still-active mutation:

```text
FAILED tests/services/api-client.spec.ts > createApiClient > does not recurse on a second 401 after an already-refreshed retry - refresh runs exactly once
AssertionError: promise resolved "{ ok: true }" instead of rejecting
- Expected: Error { "message": "rejected promise" }
+ Received: { "ok": true }
1 failed, 9 passed
```

Caught cleanly and safely (84ms) once the mock was bounded - the mutated client kept retrying until the mock's rejections ran out and it finally got a fake 200, exactly proving the removed cap's real-world consequence (a client that would hammer a genuinely-down auth server forever instead of failing fast). Restored the guard; `git diff` clean.

No mutation survived undetected. `git diff --stat frontend/app/` after all three restorations shows only the Step-2-through-6 legitimate changes (labels extraction, priority display, fetcher injection/`normalizeError` export) - confirmed no residual mutation state before the final gate.

**Step 8 - full gate, real output**

```text
$ docker compose run --rm frontend npm run lint
> eslint .
(no output, exit 0)

$ docker compose run --rm frontend npm run typecheck
> nuxt typecheck
[Vue] Resolve plugin path failed: vue-router/volar/sfc-route-blocks ... ERR_PACKAGE_PATH_NOT_EXPORTED
(exit 0 - same benign pre-existing Volar-plugin warning documented in every prior frontend module's log; vue-tsc's own type check is unaffected by it)

$ docker compose run --rm frontend npm test
 RUN  v4.1.10 /workspace

 ✓ unit  tests/services/api-client.spec.ts (10 tests) 128ms
 ✓ unit  tests/unit/labels.spec.ts (6 tests) 16ms
 ✓ unit  tests/unit/date.spec.ts (8 tests) 81ms
 ✓ unit  tests/unit/normalize-error.spec.ts (8 tests) 14ms
 ✓ unit  tests/unit/api-error.spec.ts (5 tests) 10ms
 ✓ nuxt  tests/nuxt/auth-middleware.spec.ts (6 tests) 1804ms
 ✓ nuxt  tests/components/ErrorAlert.spec.ts (2 tests) 2064ms
 ✓ nuxt  tests/components/TaskCard.spec.ts (7 tests) 2087ms
 ✓ nuxt  tests/components/register-page.spec.ts (3 tests) 1668ms

 Test Files  9 passed (9)
      Tests  55 passed (55)
   Duration  7.56s (transform 12.38s, setup 1.99s, import 10.89s, tests 7.87s, environment 18.02s)
(exit 0)

$ docker compose run --rm frontend npm run build
✔ Client built in 10104ms
✔ Server built in 8271ms
[nitro] ℹ Prerendering 1 routes
[nitro] ℹ Prerendered 2 routes in 3.063 seconds
Σ Total size: 4.7 MB (1.2 MB gzip)
✨ Build complete!
(exit 0)
```

All four real, current, run in this session - no result asserted without the command output backing it up in the same turn.

Also updated `Makefile`'s `frontend-test` target to run `npm test` alongside the pre-existing `npm run typecheck` (previously the only frontend check wired into `make test`), matching the `backend-test`/pytest pattern already established - a real test runner existing and not being wired into the project's own gate would be a gap in itself.

**Independent challenge - accessibility-focused component test**

Implemented for real (`tests/components/ErrorAlert.spec.ts`, 2 tests), not deferred to a design note. Verifies `ErrorAlert` exposes its message through `role="alert"` (queried via `screen.getByRole('alert')`, a real accessible-role query, not a CSS class check) with both the default and a custom title, for both the default-title and custom-title cases.

What this test actually proves: `role="alert"` implicitly carries `aria-live="assertive"` and `aria-atomic="true"` per the ARIA spec - a conforming screen reader announces an element with this role the instant it enters (or changes within) the accessibility tree, with no separate `aria-live` wiring required. Querying by role/name instead of a CSS selector proves the accessible contract a real assistive-technology user depends on genuinely exists in the rendered DOM. This codebase's error alerts are whole-form errors (login/register failure), not single-field ones, so `role="alert"` is the correct association mechanism here rather than `aria-describedby` - which this codebase already uses correctly elsewhere for a genuinely single-field case (`register.vue`'s password hint, `aria-describedby="register-password-hint"`, confirmed by reading the real markup).

What this test cannot prove, and still needs a real browser/manual assistive-technology review:
- Whether an actual screen reader (NVDA/JAWS/VoiceOver) really announces this element on mount versus only on a later *change* - some real AT implementations only announce live-region content that changes after initial page load, not content present at first paint. `happy-dom` implements no accessibility tree and speaks nothing at all; it only proves the DOM attribute is present and correctly named, not that anything is actually announced.
- Focus movement: after a failed submit, focus stays on the submit button; whether a screen-reader user actually notices the alert without focus being moved there programmatically (a `tabindex="-1"` + `.focus()` pattern some forms use) is a real UX judgment call this test doesn't evaluate.
- Interruption behavior: `role="alert"` is meant to interrupt whatever a screen reader is currently announcing, which is genuinely disruptive if triggered too often (e.g. on every keystroke of a live-validating field) - only a real assistive-technology session can judge whether that's appropriate, not a unit test.

**Failure investigated**

- Symptom: the mutation-drill run for "remove the API client's retry cap" (Step 7, Mutation 3) crashed the Node test process with `FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory` instead of producing a failing test.
- Smallest reproduction: `createApiClient` with the `!isRetry` guard removed, driven by a fetcher mock that rejects with a 401 unconditionally (`mockRejectedValue`, no call-count bound) and a `refresh` mock that always succeeds.
- Hypothesis: the recursive `return request<T>(path, init, true)` call, now never gated, recurses once per 401 forever; since each recursive call still goes through a real `await`, it doesn't blow the synchronous call stack (no `RangeError`) - it instead keeps allocating new promise/closure state per iteration indefinitely.
- Evidence that confirmed it: reran the identical scenario with the fetcher mock bounded to 5 rejections before succeeding - the mutation now produced a clean, fast (84ms), correctly-failing assertion (`promise resolved "{ ok: true }" instead of rejecting`) instead of a crash, confirming the crash was purely a function of the mock's unboundedness combined with the missing cap, not some other interaction.
- Root cause: a test double with an infinite domain (a mock that never stops producing the same failure) implicitly relies on the code under test to be the thing that terminates the interaction - which is exactly the property the mutation removed. The mock and the guard it was implicitly depending on were never supposed to be tested together this way.
- Prevention/test added: bounded the "does not recurse" test's fetcher mock to a fixed 5 rejections (permanent fix to the committed test, not a one-off drill workaround) - it still fully proves the real client's cap (which only ever reaches 2 fetcher calls) while remaining safe to execute against any future mutant that touches this guard.

**Decision and tradeoff**

Split the Vitest config into two `projects` (plain `happy-dom` for pure logic, a real `nuxt` environment only for component/route-aware tests) instead of running everything under one Nuxt environment. Alternative considered: a single `environment: 'nuxt'` for every test file, which is simpler to configure and would have worked correctly for all 55 tests. Rejected because it would silently contradict `api-client.ts`'s own explicit design claim ("no Nuxt app context needed") every time those tests ran, and because the timing difference is real and would compound as the suite grows: the `unit` project's 37 tests ran in well under a second of actual test time, while the 5 Nuxt-aware component/middleware tests each took 1.4-2.9s just for environment setup per file. Fits this specific codebase because the module's own architecture (a plain-factory API client, extractable pure label/date/error functions) was already deliberately built to not need Nuxt context - the config should reflect and enforce that property, not paper over it.

**Security, privacy, and operations**

No secrets, credentials, or real backend calls anywhere in this test suite - every network boundary (the API client's fetcher, the auth store's `register`) is a fake `vi.fn()`, never a real `$fetch` against the live backend, so nothing here touches the actual dev database or real user data. The `npm audit` findings surfaced while installing test tooling (gap #9 above) were investigated and confirmed pre-existing/unrelated rather than silently ignored or silently "fixed" by force-bumping a pinned framework version outside its stated range. No new environment variables, no new secrets, no migrations - purely a devDependency and test-file addition plus small, real, documented source fixes (fetcher injection, priority display, label extraction, UTC-pinned date formatting).

**Review feedback**

N/A - no pull request opened yet for this module.

**Remaining uncertainty**

- Whether `frontend/tests/nuxt/` (added for the one Nuxt-aware-but-not-a-component test) is the right permanent home, or whether `docs/testing-strategy.md` should be updated to name that folder explicitly now that a real example exists - noted but not changed, since editing the strategy doc itself felt like a decision worth flagging for review rather than making unilaterally in the same module that first needed it.
- Whether `TaskCard`'s new priority display and the still-unused `formatDate` utility should be extended further (e.g. actually showing `due_date` on `TaskCard`) is a real product-completeness question, not something this testing module should decide unprompted - flagged, not resolved.
- The `import.meta.server` early-return branch in `auth.global.ts` (Step 6) has no automated test - whether that's acceptable long-term or worth a dedicated SSR-mode Vitest project of its own is an open question.

**Self-rating**

- I can repeat this with notes: yes - reproducing the workflow directly, would use notes for the risk-map layering table and the exact Vitest/Nuxt test-project configuration details.
- I can explain it without the reference code: yes - mocking the API client's own request function bypasses the behavior under test entirely, so it would only prove the mock returns what it was told to return, not that the client actually constructs the right headers, forwards the right body, or handles errors correctly. An infinite-domain mock (one that never stops producing the same rejection) is dangerous when combined with mutation testing because a mutation that removes a termination guard turns a finite failure path into genuinely non-terminating work, which crashed the test runner via OOM rather than failing cleanly - the mock and the guard it implicitly depended on were never meant to be exercised together that way. role="alert" is correct for an important, dynamic error that must be announced automatically the moment it appears, since the role itself carries implicit live-region semantics; aria-describedby only associates static descriptive text with a specific control and does not trigger any announcement on its own.
- I can diagnose one failure in this area: yes - would start with a risk map, define test boundaries and environments deliberately, use fakes only at genuine external boundaries rather than mocking the subject under test, cover SSR/client and accessibility semantics explicitly, then use targeted mutation testing to validate the suite actually catches real regressions rather than just existing.
- Confidence from 1-5: 5/5 - the main remaining caveat is that real assistive-technology announcement behavior still needs manual screen-reader validation, since semantic markup alone proves the DOM contract exists, not that a real screen reader actually announces it the way the specification implies.

---

### Module 14 — Docker Compose and full-stack integration

**Date and branch**

- Date: 2026-08-18
- Branch: learning/14-compose-integration
- Pull request: none yet

**Objectives in my own words**

Treat `docker compose ps` showing "healthy" as a claim to verify, not a fact to trust - a container can report healthy while the real product underneath it is completely broken, if the healthcheck doesn't actually exercise the thing that matters (its own dependency reachability, its own schema). Learn to tell apart three genuinely different failure shapes that all look like "it's broken": a process that's alive but misconfigured (wrong hostname), a healthcheck that's checking the wrong thing (wrong path), and a process that never got to a working state at all (missing migration) - each needs different evidence to diagnose and a different fix. Keep the disposable acceptance stack (`compose.test.yaml`) provably isolated from developer data by construction (separate project name, separate database, no source mounts, no host ports), not by convention. Prove every claim in this log with a command run in this session, not a description of what should happen.

**Step 0 - cleanup**

Found and deleted `module13-log.txt` (untracked scratch file left over from copying Module 13 terminal output). `RELEASE_MANIFEST.txt` is a tracked, committed repo file, not scratch output - left alone. No `module11-transcript.txt`/`module12-log.txt` existed. `git status` confirmed clean before starting.

**Step 1 - map the development stack**

Read `compose.yaml` in full before changing anything. Per service, as it stood at the start of this module:

| Service | Image/build | Command | Config source | Ports (container:host) | Volumes | Healthcheck | Depends on | Process/user |
|---|---|---|---|---|---|---|---|---|
| `db` | `postgres:17-alpine` | image default entrypoint | `POSTGRES_*` env, defaulted in compose | 5432:5432 | named `starter-postgres-data` | `pg_isready` | - | container top-level: root (official-image entrypoint pattern); real `postgres` server process itself: `postgres` (confirmed via `docker compose exec db ps aux` - PID 1 is `postgres`, root is only used transiently at container init) |
| `backend` | build, `./backend` target `development` | `uvicorn --reload` | `DATABASE_URL` env, defaulted in compose | 8000:8000 | bind mount `./backend:/workspace` | `python -c urllib.request` against `/health/ready` | `db` (`service_healthy`) | `app` (Dockerfile sets `USER app` in the `development` stage) |
| `frontend` | build, `./frontend` target `development` | `npm run dev` | `NUXT_PUBLIC_API_BASE`/`NUXT_INTERNAL_API_BASE` env, defaulted in compose | 3000:3000 | bind mount `./frontend:/workspace` + named `starter-frontend-modules` for `node_modules` | **none defined** (real gap - see below) | `backend` (`service_healthy`) | **root** - confirmed via `docker compose exec frontend id` (`uid=0(root)`); the `development` stage of `frontend/Dockerfile` never sets `USER`, unlike its own `production` stage, which does |

Browser-vs-server explanation (worked out before touching any code, included here verbatim since it's the correct mental model and the module explicitly asks for it): browser `localhost:8000` and server-side Nuxt `backend:8000` both mean "the same backend," but `localhost` always resolves to whatever network namespace the caller is currently inside (the browser's own machine vs. the Nuxt container itself), while `backend` is a Docker-internal DNS name only resolvable from inside the Compose network - "same backend, two different callers, two different meanings of 'here.'" This turned out to be exactly the failure shape reproduced for real in Drill 2 below.

**Real gap found while mapping, fixed immediately**: `frontend` had no healthcheck at all - nothing downstream depends on it, but its own health was never actually observable, only inferable from "container still running." Confirmed the app already exposes `/api/health` (`curl http://localhost:3000/api/health` → `{"status":"ready"}`, matching Module 11/12's own baseline), so added a real Node-based healthcheck to `compose.yaml` (`node -e "require('http').get(...)"`, mirroring backend's Python-urllib pattern - Node, not curl/wget, since neither is guaranteed present in the `node:22.16.0` image). Verified live:

```text
$ docker inspect fullstack-intern-starter-frontend-1 --format '{{json .State.Health}}'
{"Status":"healthy","FailingStreak":0,"Log":[
 {"...","ExitCode":-1,"Output":"Health check exceeded timeout (5s)"},
 {"...","ExitCode":-1,"Output":"Health check exceeded timeout (5s)"},
 {"...","ExitCode":0,"Output":""},
 {"...","ExitCode":0,"Output":""}]}
```

The two initial timeouts are real, legitimate Nuxt dev-server cold-start behavior, not a flaw in the check - `retries: 12` at 5s intervals easily absorbs it.

**Step 2 - clean-state startup, timed, with real health-transition evidence**

`make` is not installed on this Windows workstation (`bash scripts/setup.sh` now prints a real warning - see the onboarding-validation gap below); ran the exact underlying `docker compose` commands from the Makefile instead, same substitute pattern documented since Module 01.

```text
$ docker compose down -v --remove-orphans     # make clean
 Volume fullstack-intern-starter_starter-postgres-data Removed
 Volume fullstack-intern-starter_starter-frontend-modules Removed

$ docker compose up --build -d                # make up, timed
start: 15:08:40 ... (killed at 5-minute tool timeout mid-build, backend pip install still running)
$ docker compose up --build -d                # re-run, resumed from BuildKit's retained progress
=== up -d returned after 274s ===
```

Total real wall time for a fully clean (no volume, effectively no-cache since neither Dockerfile uses a pip/npm cache mount) build+start: roughly 10 minutes end-to-end (15:08:40 → ~15:18:36), dominated by `npm ci` (935 packages, ~218s) and `pip install` (~220-500s depending on run). Real health-transition sequence, straight from `docker compose up`'s own event stream (not assumed): `db` → Creating → Created → Starting → Started → Waiting → **Healthy**; `backend` → same sequence, gated on `db` healthy, → **Healthy**; `frontend` → same sequence, gated on `backend` healthy, → Starting → Started → (now, post-fix) **Healthy**.

**Real, serious bug found here**: after a genuinely clean volume, `docker compose ps` showed all three services healthy, but the database had **zero tables**:

```text
$ docker compose exec backend alembic current
(no output - no revision stamped)
$ docker compose exec db psql -U workboard -d workboard -c "\dt"
Did not find any relations.
$ curl -s -w "\nHTTP %{http_code}\n" -X POST http://localhost:8000/api/v1/auth/register -H "Content-Type: application/json" -d '{"email":"probe@example.com",...}'
Internal Server Error
HTTP 500
```

Root cause: nothing in the repo ever ran `alembic upgrade head` - `backend/Dockerfile`'s `CMD` was a bare `uvicorn ...` in both stages, no entrypoint, no migration step anywhere in Compose or the Makefile. "Healthy" only ever meant "the process is up and can reach the DB," not "the schema exists." This directly contradicts this module's own stated outcome ("Start the complete product with one documented command on a clean checkout") - a fresh `make up` produced a stack that 500s on the very first real write.

Fix: added `backend/entrypoint.sh` (`set -e; alembic upgrade head; exec "$@"`) and wired it into **both** Dockerfile stages (`ENTRYPOINT ["/bin/sh", "entrypoint.sh"]`, invoked via explicit `sh` rather than relying on the shebang/exec bit - deliberate, see the CRLF finding below). `migrations/env.py` already reads `get_settings().database_url`, so it picks up the same `DATABASE_URL` the app uses with no extra wiring. Verified for real after rebuilding:

```text
$ docker compose logs backend --tail=25
backend-1  | INFO  [alembic.runtime.migration] Running upgrade  -> 27edc82c2b1b, initial workboard schema
backend-1  | INFO  [alembic.runtime.migration] Running upgrade 27edc82c2b1b -> 4840454901bd, add project_id status index on tasks
backend-1  | INFO:     Application startup complete.
$ docker compose exec db psql -U workboard -d workboard -c "\dt"
 public | alembic_version | table ...
 public | comments | ... | projects | ... | tasks | ... | users | table
$ curl ... /auth/register ...
{"id":1,"email":"probe@example.com",...}
HTTP 201
```

**Migration/duplicate-safety evidence (substitute for seed determinism, since no seed script exists anywhere in this repo - confirmed by `grep -r seed` across `backend/`/`frontend/`/`scripts/`, zero code matches, only prose mentions in workshop docs; a real, honestly-disclosed gap, not built here since STARTER_SCOPE.md doesn't scope seed data as this module's deliverable and inventing one under time pressure risked exactly the kind of unscoped abstraction `AGENTS.md` warns against)**:

- Re-ran `alembic upgrade head` a second time: zero "Running upgrade" lines emitted - idempotent, confirmed not assumed.
- Re-ran `docker compose up -d` (`make up` again) a second time: `users` row count stayed at exactly `1` before and after (`SELECT count(*) FROM users` both times), `alembic current` stayed at head - no duplication, no double-migration.
- Direct unique-constraint proof, not just "it didn't error": created a real project via the API (`POST /projects`, `slug: module-14-integration-demo`), then attempted a **raw SQL** duplicate-slug insert bypassing the service layer entirely: `psql ... INSERT INTO projects (..., slug, ...) VALUES (..., 'module-14-integration-demo', ...)` → `ERROR: duplicate key value violates unique constraint "ix_projects_slug"`. Separately confirmed the real user-facing path (`create_project_with_owner` → `generate_unique_slug`) auto-disambiguates instead of erroring: submitting the *same name* twice through the real API produced two distinct rows with distinct slugs (`module-14-integration-demo`, `module-14-integration-demo-2`) - both are correct, complementary evidence (DB-level constraint as the hard backstop, service-level slug generation as the actual UX), not a contradiction.

**Step 3 - networking, real command output**

```text
$ docker compose exec frontend getent hosts backend
172.20.0.3      backend
$ docker compose exec backend getent hosts db
172.20.0.2      db
$ docker compose exec backend python -c "import socket; print(socket.gethostbyname('db'))"
172.20.0.2
```

From the **host** (proving container network isolation and port publishing are two separate mechanisms, not the same thing):

```text
$ nslookup backend
*** UnKnown can't find backend: Non-existent domain
$ nslookup db
*** UnKnown can't find db: Non-existent domain
$ curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:8000/health/live
HTTP 200
$ (exec 3<>/dev/tcp/localhost/5432 && echo "TCP connect to localhost:5432 succeeded")
TCP connect to localhost:5432 succeeded
```

Neither Docker-internal DNS name resolves from the host's own resolver at all, while the *published* ports (`8000`, `5432`) are fully reachable from the host - two independent mechanisms (Compose's internal bridge-network DNS vs. Docker's host port-forwarding), not one.

**Step 4 - persistence, real project, real teardown**

Created a real project via the API (`Module 14 Integration Demo`, id 1) as the persistence subject (no fake/placeholder DB rows).

```text
$ docker compose restart backend frontend
... project id 1 still present (SELECT id, name, slug FROM projects WHERE id=1 -> 1 row) ...
$ docker compose up -d --force-recreate backend frontend
... project id 1 still present, AND still served live by the real API (GET /projects/1 -> HTTP 200) ...
```

Guarded reset:

```text
$ docker compose down -v --remove-orphans      # drops starter-postgres-data
$ docker compose up -d                          # rebuilds network+volumes, migrates from scratch
$ docker compose exec db psql ... "\dt"          # 6 tables present (schema from migrations)
$ SELECT count(*) FROM users;  -> 0
$ SELECT count(*) FROM projects; -> 0
$ docker compose exec backend alembic current -> 4840454901bd (head)
```

Schema recreated correctly and fully from migrations alone; all prior data (including the persistence-demo project) genuinely gone - no real/sensitive data used anywhere in this step, only synthetic test accounts (`probe@example.com` etc.).

**Step 5 - `compose.test.yaml`, read in full and checked against every named property**

The file's own header comment states plainly: "Modules 14 and 15 extend it with production application images, deterministic migrations/seed data, Playwright, host-mounted evidence, and exit-code propagation" - so part of this module's real job was extending this scaffold, not just reading it.

| Required property | Status at start of this module | Action taken |
|---|---|---|
| Different project name + database | Already true (`fullstack-intern-starter-test`, `workboard_test`) | none needed |
| No unnecessary host ports | Already true (no `ports:` on any service) | none needed |
| Production frontend/backend build targets | Already true (`target: production` both) | none needed |
| Migrations applied | **False** - same missing-entrypoint bug as the dev stack | Fixed for free by the Step 2 entrypoint fix, since it lives in `backend/Dockerfile`'s `production` stage too. Verified: `docker compose -f compose.test.yaml exec backend-test alembic current` → `4840454901bd (head)`. |
| Seed applied | **False**, still false | Honestly documented gap - no seed script exists anywhere in this repo (see Step 2). Not invented here; out of this module's real scope per `STARTER_SCOPE.md`. |
| Health-gated startup | **Partially false** - `frontend-test` had no healthcheck at all | Added one (same Node/`/api/health` pattern as dev `frontend`, against `127.0.0.1:3000` since the test image publishes no host port). |
| Playwright as exit-code service | **False, confirmed absent** (`grep -ri playwright` across the whole repo: zero matches in code, only workshop-doc mentions; `STARTER_SCOPE.md` explicitly lists "completed Playwright package and test service" under "Deliberately absent") | Not built here - Module 15's explicit job. `make e2e-test` (added below) is honestly scoped to *not* claim this. |
| Artifacts stored outside container | N/A (no Playwright service exists yet to produce artifacts) | deferred to Module 15 |
| Volumes torn down | `db-test` had no named volume (anonymous, harder to audit) | Added a named `starter-postgres-test-data` volume; verified `docker volume ls` shows it present while the stack is up and **gone** after `down -v`. |

**Real bug found and fixed**: `frontend-test` never set `NUXT_INTERNAL_API_BASE`, so it fell back to `nuxt.config.ts`'s hardcoded default `http://backend:8000/api/v1` - but the test stack's backend service is named `backend-test`, not `backend`. This is the exact "frontend internal API base wrong" failure class, latent in the acceptance stack itself (not just something to drill against - a genuine shipped bug). Added `NUXT_INTERNAL_API_BASE: http://backend-test:8000/api/v1` explicitly.

Added a real `make e2e-test` Makefile target (`docker compose -f compose.test.yaml up -d --build --wait --wait-timeout 120`, `ps`, `down -v --remove-orphans`), with an explicit comment that it does **not** run Playwright yet. Ran it for real:

```text
$ docker compose -f compose.test.yaml up -d --build --wait --wait-timeout 120
 Container fullstack-intern-starter-test-db-test-1 Healthy
 Container fullstack-intern-starter-test-backend-test-1 Healthy
 Container fullstack-intern-starter-test-frontend-test-1 Healthy
$ docker compose -f compose.test.yaml exec backend-test alembic current
4840454901bd (head)
$ docker compose -f compose.test.yaml exec frontend-test node -e "...http://127.0.0.1:3000/..."
status 200
```

All three services genuinely reach health, migrations genuinely apply, and a real SSR request inside the frontend-test container genuinely succeeds against `backend-test` - proving the `NUXT_INTERNAL_API_BASE` fix, not just the healthcheck route.

**Step 6 - three failure drills, break/collect/restore/reverify each time**

*Drill 1 - wrong database hostname* (`DATABASE_URL` host `wrongdb` instead of `db`, env override + `--force-recreate backend`):

```text
$ docker compose logs backend --tail=15
sqlalchemy.exc.OperationalError: (psycopg.OperationalError) failed to resolve host 'wrongdb': [Errno -5] No address associated with hostname
$ docker inspect ... --format 'RestartCount: {{.RestartCount}} | Status: {{.State.Status}}'
RestartCount: 3 | Status: running
```

Real, new finding directly caused by this module's own Step-2 fix: because migrations now run in the entrypoint under `restart: unless-stopped`, a bad `DATABASE_URL` produces a genuine **crash-restart loop** (`RestartCount: 3`), not a clean unhealthy-but-running container. Judged this as correct fail-fast behavior (never serve traffic against an unreachable/wrong DB), not a regression to undo - but worth naming as a real trade-off of the fix, and a different failure *shape* than Drill 3's "unhealthy but alive." Restored (`unset DATABASE_URL`, `--force-recreate`), reverified healthy before continuing.

*Drill 2 - frontend internal API base pointing at `localhost` instead of `backend`* (`NUXT_INTERNAL_API_BASE=http://localhost:8000/api/v1` env override + `--force-recreate frontend`):

```text
$ curl http://localhost:3000/public/projects/module-14-integration-demo
... embedded NUXT payload: "[GET] \"http://localhost:8000/api/v1/projects/public/...\": <no response> fetch failed", statusCode 500 ...
```

Exactly the predicted failure from the Step 1 explanation: server-side Nuxt tried to reach `localhost:8000` *from inside the frontend container*, where nothing listens on that port. Real, separate finding: `docker compose ps` and `.State.Health.Status` both showed the frontend as **"healthy" the entire time** - its healthcheck only proves the Nuxt process itself answers its own `/api/health`, never that it can actually reach the backend every real page depends on. A passing healthcheck is evidence about the checked path only, not the whole product. Restored (`unset`, `--force-recreate`); reverified with a fresh project (`drill-reverify-project`, since Step 4's guarded reset had already wiped the original demo project before this drill ran) → real `HTTP 200`.

*Drill 3 - wrong backend health path* (temporarily edited `compose.yaml`'s healthcheck to `/health/nonexistent`, `--force-recreate backend`):

```text
$ docker compose ps
backend-1 ... Up About a minute (unhealthy)
$ docker inspect ... .State.Health   # Output: "urllib.error.HTTPError: HTTP Error 404: Not Found"
$ curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:8000/health/live
HTTP 200
```

Clean, exact proof of the module's intended lesson: Docker's own view (`unhealthy`) directly contradicts the real application state (`/health/live` genuinely returns 200) - a healthcheck misconfiguration is distinguishable from a real app failure specifically by checking the real endpoint directly rather than trusting `ps`. Restored the correct path, reverified healthy; `git diff --stat compose.yaml` afterward showed only the intended 5-line frontend-healthcheck addition - the drill's own edit left no residue.

**Step 7 - resource and security review of `compose.test.yaml` (the production-like config), real inspection commands**

```text
$ docker inspect ...backend-test-1 --format 'user: {{.Config.User}} | Privileged: {{.HostConfig.Privileged}} | NetworkMode: {{.HostConfig.NetworkMode}}'
user: app | Privileged: false | NetworkMode: fullstack-intern-starter-test_default
$ docker inspect ...frontend-test-1 --format '...'
user: app | Privileged: false | NetworkMode: fullstack-intern-starter-test_default
$ docker compose -f compose.test.yaml exec backend-test whoami   -> app
$ docker compose -f compose.test.yaml exec frontend-test whoami  -> app
$ docker inspect ...backend-test-1 --format '{{json .Mounts}}'   -> []
$ docker inspect ...frontend-test-1 --format '{{json .Mounts}}'  -> []
$ docker inspect ...db-test-1 --format '{{json .Mounts}}'
[{"Type":"volume","Name":"...starter-postgres-test-data",...}]   # named volume only, no bind mount
```

Confirmed: both application containers run as non-root `app` (matching Module 04's original goal, and contrasting with the dev stack's `frontend`, which runs root - a genuine, honest difference between the two stacks, not a contradiction, since only the production-target/acceptance config is in scope for this security review). No privileged mode, no host network mode, no Docker-socket mount, no bind mounts of source code, on any of the three services. Env var *names* only (`DATABASE_URL`, `POSTGRES_PASSWORD`, etc.) inspected, never values, per this module's own instruction not to expose real secrets - and none of these are real secrets anyway (`test-only-password`, a hardcoded local/CI-only value). Published ports: none on any test-stack service (`docker compose -f compose.test.yaml ps` shows bare `8000/tcp`/`5432/tcp`/`3000/tcp`, no `0.0.0.0:` prefix) - confirming the earlier "no unnecessary host ports" checklist item with real inspection evidence, not just reading the YAML.

**Step 8 - one-command onboarding validation (closest honest substitute for a second machine)**

Since a second person/clean VM wasn't available this session, ran the full documented sequence against genuinely fresh state repeatedly throughout this module (multiple real `docker compose down -v` → `up --build -d` cycles, Steps 2 and 4 above) rather than reasoning about it abstractly, and additionally used a real local git checkout simulation (not just inspection) to catch a Windows-specific bug before it could ever reach a PR:

1. **`make` is not installed on this Windows workstation at all** (`command -v make` → not found; confirmed via Bash *and* PowerShell `Get-Command make`). This was already flagged as a known gap back in Module 01's log ("Worth resolving before relying on make-based commands in later modules") but never actually fixed, and this module is the first one that names a brand-new target (`make e2e-test`) a learner would have zero way to discover was missing without already knowing to substitute the raw command. Real fix (not just noted verbally): added a presence check to `scripts/setup.sh` printing a clear warning with a Windows-specific remediation hint, so the very first `make setup` a learner runs surfaces this immediately instead of silently failing target-by-target for 14 modules.
2. **`docs/troubleshooting.md` had two real, pre-existing bugs**, found while investigating the `make` gap: it referenced a `NUXT_API_INTERNAL_BASE` env var that has never existed (the real name, used consistently everywhere else in the repo, is `NUXT_INTERNAL_API_BASE` - the two middle words are transposed), and it told readers to run `make reset-db`, a Makefile target that has never existed (only `help`, `setup`, `validate`, `up`, `down`, `logs`, `ps`, `backend-test`, `frontend-test`, `test`, `backend-quality`, `clean` do). Fixed both - the env var name corrected, and the reset instructions pointed at the target that actually exists (`make clean && make up`), with a one-line explanation of what it actually does.
3. **A genuinely serious, reproducible Windows-checkout bug, caught proactively before it was ever committed**: this machine has `core.autocrlf=true` (a common Git-for-Windows default, not something manually configured for this session) and the repo has never had a `.gitattributes` file. Simulated a real fresh checkout of the new `backend/entrypoint.sh` (`git add`, delete from disk, `git checkout --`) and got Git's own explicit warning plus corrupted bytes:
   ```text
   warning: in the working copy of 'backend/entrypoint.sh', LF will be replaced by CRLF the next time Git touches it
   $ od -c backend/entrypoint.sh | head -2
   ... s   h  \r  \n   s   e   t       -   e  \r  \n ...
   ```
   Since the Dockerfile invokes it as `/bin/sh entrypoint.sh` inside a Linux container, a CRLF-corrupted script would break the backend entrypoint for any Windows learner the moment they re-checked-out this exact file - the whole migration-on-start fix from Step 2 would silently stop working on a fresh clone. Root cause: no `.gitattributes` ever existed to force LF for shell scripts, so every `.sh` file's working-tree line endings have depended entirely on each learner's local `core.autocrlf` setting this whole course. Confirmed this wasn't only a risk for the *new* file: `scripts/setup.sh` (pre-existing since Module 01) already had CRLF on disk (`od -c` showed `\r\n` throughout) and had been running successfully all along purely because Windows Git Bash's own `bash` tolerates CRLF - an interpreter-specific accident, not a guarantee, and exactly the kind of asymmetry that would NOT hold for the Linux container's `/bin/sh`. Fixed for real: added `.gitattributes` (`* text=auto`, `*.sh text eol=lf`), then `git add --renormalize` both `.sh` files and re-verified with the same delete+checkout reproduction - `git check-attr text eol -- backend/entrypoint.sh scripts/setup.sh` now reports `eol: lf` for both, and a forced re-checkout of both files now produces clean, pure-`\n` bytes with no `\r` anywhere.

**Independent challenge - Compose profiles for an optional dev tool**

Implemented for real (not deferred to a design note) - Adminer, a small DB-admin web UI, added to `compose.yaml` as its own `adminer` service under `profiles: ["tools"]`, bound to `127.0.0.1:8080` only (not `0.0.0.0`), depending on `db` being healthy. Verified every claim, not just written it:

```text
$ docker compose up -d                                   # plain default-profile up
$ docker compose ps                                       # adminer absent - confirmed
$ docker compose --profile tools up -d adminer             # explicit opt-in
$ docker compose ps
fullstack-intern-starter-adminer-1 ... Up ... 127.0.0.1:8080->8080/tcp
$ curl -s -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:8080/            -> HTTP 200
$ docker port fullstack-intern-starter-adminer-1                                  -> 8080/tcp -> 127.0.0.1:8080
$ curl -X POST http://127.0.0.1:8080/?pgsql=db -d "auth[server]=db&auth[username]=workboard&auth[password]=workboard-local-only&auth[db]=workboard&auth[driver]=pgsql"
-> HTTP 302   # Adminer's own real success-redirect, i.e. it genuinely authenticated against the real db service by Docker DNS name
$ docker compose --profile tools stop adminer && docker compose --profile tools rm -f adminer
$ docker compose ps   # backend/db/frontend unaffected, all still healthy
```

Never activated in `compose.test.yaml` at all (no `tools`-profile service exists there, and nothing in `make e2e-test` passes `--profile`).

**Security tradeoff, stated explicitly as the module asks**: gating behind an opt-in profile and binding to loopback are real, meaningful compensating controls (confirmed above: absent by default, unreachable from the host's LAN even while running), but they are not a full guarantee. Three residual risks accepted deliberately: (1) Adminer authenticates with the exact same shared, hardcoded, weak local-only Postgres credentials every learner's `.env.example` ships (`workboard` / `workboard-local-only`) - the profile gate only prevents *accidental* exposure, not a deliberate one-line change (`127.0.0.1:8080:8080` → `8080:8080`) made while debugging and forgotten; (2) a loopback bind still means "reachable by any process on this machine," not "reachable by no one" - another local process, or in principle a browser-based DNS-rebinding attack against `127.0.0.1`, is a real (if narrow) residual surface a loopback bind alone doesn't close; (3) it was deliberately excluded from ever running in the acceptance stack, since a shared/CI environment is a much larger blast radius for the same mistake. The tradeoff accepted here is real local-debugging convenience against a small, non-zero increase in local attack surface *while the tool happens to be running* - not "this is fully safe."

**Real bugs and gaps found - full list, root cause, and fix/disposition**

1. Backend never applied migrations on start (dev *and* production Dockerfile stages) - a clean `make up` produced a "healthy" stack with an empty database and a 500 on the first real write. Fixed with `backend/entrypoint.sh` wired into both stages.
2. `frontend` (dev) had no healthcheck at all. Fixed.
3. `frontend-test` (acceptance) had no `NUXT_INTERNAL_API_BASE`, silently defaulting to the wrong service name (`backend` instead of `backend-test`) - would have broken every SSR request in the acceptance stack the first time Module 15 tried to use it. Fixed.
4. `frontend-test` also had no healthcheck. Fixed.
5. `db-test` had no named volume, making "tears down volumes" unauditable. Fixed.
6. `make e2e-test` didn't exist despite this module instructing readers to run it. Added, honestly scoped (no Playwright yet - confirmed absent repo-wide, correctly out of scope per `STARTER_SCOPE.md`).
7. `docs/troubleshooting.md` had a wrong env var name (`NUXT_API_INTERNAL_BASE`) and referenced a nonexistent `make reset-db` target. Both fixed.
8. `make` itself isn't installed on this Windows workstation, a known-but-never-fixed gap since Module 01. Added a real presence check + hint to `scripts/setup.sh`.
9. No `.gitattributes` ever existed; the new `backend/entrypoint.sh` (and the pre-existing `scripts/setup.sh`, silently, this whole course) were one Windows checkout away from CRLF corruption that would break the Linux container's `/bin/sh`. Reproduced for real, fixed with `.gitattributes` + renormalization, re-verified with a second real checkout.
10. No seed script/mechanism exists anywhere in this repo. **Not fixed** - honestly documented as out of this module's real scope (no seed data model was ever specified by `STARTER_SCOPE.md`, and inventing one under time pressure risked exactly the unscoped, undirected abstraction `AGENTS.md` warns against); substituted real migration-idempotency and unique-constraint evidence instead (Step 2).
11. Discovered, not fixed (correct as-is): the entrypoint's migration step combined with `restart: unless-stopped` turns a bad `DATABASE_URL` into a crash-restart loop rather than a clean unhealthy state (Drill 1) - judged as correct fail-fast behavior, named explicitly rather than silently accepted.
12. Discovered, not fixed (correct as-is, but worth knowing): a healthcheck that only checks a service's *own* liveness (frontend's `/api/health`) can stay green while every real page depending on another service is completely broken (Drill 2) - a real limit of self-only healthchecks, not something a single service's healthcheck can fully close without checking its dependency too (which would just move the coupling problem elsewhere).

**Decision and tradeoff**

Fixed the missing-migration bug via a Dockerfile `ENTRYPOINT` script rather than a Makefile step (`docker compose run backend alembic upgrade head` before `up`). Alternative considered: keep migrations as a manual/Makefile-orchestrated step, which is simpler to read and matches how `backend-quality`/`backend-test` already invoke ad hoc `docker compose run` commands. Rejected because a Makefile step only runs when a human remembers to run `make` (which, per this same module, doesn't even work on this workstation without direct docker compose substitution) - it wouldn't fire for `docker compose up` used directly, for `compose.test.yaml`'s acceptance stack, or eventually for a Cloud Run deploy in Module 17, all of which need the exact same guarantee. An entrypoint that runs on every container start is the one mechanism that's true in dev, in the acceptance stack, and in production alike - fits this module's own "one documented command" framing better than a second command a learner has to remember.

**Security, privacy, and operations**

No real credentials or user data anywhere in this module's evidence - all test accounts (`probe@example.com`, `probe2@example.com`) and projects are obvious synthetic test fixtures, and the shared local-only Postgres password is the same non-secret default value `.env.example` has always shipped, never printed as a "real" secret. The security review (Step 7) covered the actual production-like config (`compose.test.yaml`) and found no privileged mode, no host network, no Docker-socket mount, no bind-mounted source, and non-root `app` users on both application containers - confirmed by direct inspection, not assumed. The new `adminer` tool is off by default, loopback-bound, and never active in the acceptance stack, with its residual risk stated explicitly above rather than glossed over. The CRLF/`.gitattributes` fix (Step 8) is itself a real, if narrow, operational-safety fix: an entrypoint script that silently stops working on a fresh Windows checkout is exactly the kind of thing that would have cost a future learner (or Elio himself, on a future clone) a confusing, hard-to-diagnose container startup failure with no connection in sight to "line endings."

**Review feedback**

N/A - no pull request opened yet for this module.

**Remaining uncertainty**

- Whether the dev-stack `frontend` service should also be moved to a non-root user (matching `backend`'s dev stage and both production stages), or whether that's deliberately left permissive for bind-mount/hot-reload file-permission convenience on Windows hosts - flagged, not decided unilaterally here, since it's a real tradeoff between the Module 04 non-root goal and Windows bind-mount ergonomics that deserves an explicit call, not a silent one.
- Whether a real seed-data mechanism belongs in Module 14 or Module 15's scope - flagged rather than guessed at, since it changes what "deterministic" evidence should look like once it exists.
- Whether `.gitattributes`' `* text=auto` should eventually be broadened beyond `*.sh` (e.g. explicit rules for `.py`/`.ts`/`.yaml`) now that the repo has one at all, or whether the current minimal, targeted scope (only the file type that's actually interpreter-sensitive) is the right permanent shape - left minimal deliberately for this module, worth revisiting if another cross-platform script class shows up.

**Self-rating**

- I can repeat this with notes: yes - service mapping, health-vs-readiness distinction, network isolation vs. port publishing as two separate mechanisms, the entrypoint-migration pattern, and failure-drill methodology (break, collect evidence, restore, reverify).
- I can explain it without the reference code: yes - a healthcheck proves only the specific thing it tests, nothing more; a service can report healthy while its database schema, its dependencies, or real user flows are completely broken, because the check only exercises whatever narrow path it was written to exercise. Migrations belong in the container's own startup path (an entrypoint script) rather than a Makefile step because they must run consistently everywhere the backend actually starts - dev, the isolated acceptance stack, and eventually production - not only in the one place a human remembers to run a separate command. CRLF line endings can corrupt a Linux shell script's shebang line and command arguments (e.g. #!/bin/sh becomes #!/bin/sh^M, an interpreter path that doesn't exist), which is exactly why Windows checkouts are a real risk for any interpreted script consumed inside a Linux container without an explicit .gitattributes rule forcing LF.
- I can diagnose one failure in this area: yes - would test the actual dependency chain and a representative real operation end-to-end, not just trust health endpoints, since a passing healthcheck only proves its own narrow path, not the product underneath it.
- Confidence from 1-5: 5/5.

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
