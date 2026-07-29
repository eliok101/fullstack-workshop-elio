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
