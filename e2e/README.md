# End-to-end test suite

Playwright `1.61.1` (pinned - see `VERSION_MATRIX.md`), matched to the `mcr.microsoft.com/playwright:v1.61.1-noble` Docker image used by this directory's `Dockerfile`.

Runs against the isolated acceptance stack (`compose.test.yaml`), never the developer stack - production frontend/backend images, real PostgreSQL, no shared/mutable seeded state. See `docs/testing-strategy.md` for what this layer is and isn't responsible for.

## Running

Containerized, against the real acceptance stack (the supported path):

```bash
make e2e-test
```

Locally, against `docker compose up` (the dev stack) while iterating on a single test:

```bash
cd e2e
npm install
npx playwright test --project=chromium tests/critical-journey.spec.ts
```

## Layout

- `tests/api-readiness.spec.ts` - backend/frontend health, run first so a readiness failure is diagnosable separately from a browser journey failure.
- `tests/critical-journey.spec.ts` - the one full, real, browser-driven journey (register through sign-out).
- `tests/invalid-transition.spec.ts` - the real deployed API rejects an illegal task-status transition (409, via Playwright's request context, not the UI - the UI never exposes this control at all).
- `tests/ssr-metadata.spec.ts` - the public project page is genuinely server-rendered (raw HTTP, not just a passing browser render).
- `tests/mobile-journey.spec.ts` - the one real mobile-viewport-specific risk (see the file's own comment for which one and why).
- `fixtures/` - unique test-data generation and thin real-API setup helpers, never a substitute for the browser behavior under test.

## Cross-browser

Chromium is the default gate (`make e2e-test`, and the `chromium` project). Firefox/WebKit are configured as separate Playwright projects, run deliberately (`npx playwright test --project=firefox`), not on every gated run - see the Module 15 learning log entry for the real support-matrix decision and reasoning.
