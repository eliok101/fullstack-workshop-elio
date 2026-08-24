# ADR 007: Cross-origin session topology for separately-hosted Cloud Run services

- Status: Proposed - reasoned from the committed workflow, `docs/security.md`, `docs/deployment.md`, and Module 15's real findings; not yet validated against a live deployment, since Module 17's own Terraform apply was not performed (billing was not enabled - see the Module 17 learning-log entry).
- Date: 2026-08-24

## Context

`deploy-gcp.yml` deploys the backend and frontend as two independent Cloud Run services, each receiving Google's default `*.run.app` URL, discovered only after each service is actually deployed (`gcloud run services describe ... --format='value(status.url)'`). The backend's refresh-token cookie is set with `Secure` and `SameSite=None` in production (`REFRESH_COOKIE_SECURE=true,REFRESH_COOKIE_SAMESITE=none`), and `CORS_ORIGINS` is restricted to the frontend's real URL only after that URL is known.

This exact shape was already a real finding in Module 15: the refresh cookie was originally hardcoded `SameSite=Lax`, which is structurally incapable of surviving a cross-hostname reload at all - fixed to `SameSite=None` + `Secure` for production. That fix could not be validated end-to-end locally, because the local acceptance stack (`compose.test.yaml`) has no HTTPS, and `Secure` cookies are never sent over plain HTTP. `docs/security.md` and `docs/deployment.md` both independently flag the same unresolved question: does the fixed attribute combination actually deliver a working session on two separate default Cloud Run URLs, and what does a passing CORS/smoke check actually prove about that?

## Decision question

Does the default two-separate-`.run.app`-URL topology, with `SameSite=None; Secure`, actually work for real browsers - and if not reliably, what would?

## Reasoning

**What `SameSite=None` actually requires, precisely**: the `Secure` attribute (HTTPS only) - it does not require the same domain or even the same registrable site. Its entire purpose is the opposite of `Lax`/`Strict`: it explicitly permits the cookie to be sent on cross-site requests, provided the connection is HTTPS. Both Cloud Run services get real, valid HTTPS `*.run.app` URLs by default. So the `Lax` → `None`+`Secure` fix that Module 15 made is not just "theoretically correct" - it removes the one protocol-level guarantee that made the old configuration certain to fail (`Lax` blocking any cross-site send outright). This is a real, structural improvement, not a cosmetic one.

**What this does not fix, and why it's still fragile in practice**: a cookie set by `workboard-api-xxxx.run.app` while the top-level page is served from `workboard-web-yyyy.run.app` is classified by the browser as a *third-party* cookie in this exchange, because the two services sit under different registrable domains from the browser's point of view (both being subdomains of the shared `run.app` suffix does not make them same-site - `run.app` itself is a public suffix, so each `*.run.app` service is its own distinct site). Independent of `SameSite` semantics, browsers increasingly restrict third-party cookies by default: Safari's Intelligent Tracking Prevention blocks essentially all third-party cookies out of the box; Chrome's third-party-cookie deprecation and Enhanced/strict tracking-protection modes in Firefox target exactly this shape; every major browser's private/incognito mode tends to be stricter still. None of this is a `SameSite=None` protocol violation - the attribute is doing exactly what it says - but it means whether the refresh cookie actually survives in a given real user's browser depends on that browser's separate, independently-evolving privacy policy, not on anything this workflow controls.

**What CORS success proves, and what it doesn't**: a passing CORS preflight (`Access-Control-Allow-Origin` matching the frontend's exact origin, `Access-Control-Allow-Credentials: true`) proves the server is willing to answer a credentialed cross-origin request. It says nothing about whether the browser's separate cookie-partitioning/third-party-cookie policy will actually attach or accept the cookie on that same exchange - CORS and cookie policy are two independent browser subsystems that both have to pass. This workflow's own smoke checks (`curl .../health/ready`, `.../api/health`, `/`) exercise neither: `curl` has no concept of `SameSite`, third-party-cookie partitioning, or even CORS preflight enforcement, so a fully green smoke-check run proves only that both URLs are reachable and return the expected status - exactly what `docs/deployment.md` already states plainly ("Endpoint smoke checks against default Cloud Run URLs prove reachability, not complete browser-session compatibility").

## Decision

Treat the current default two-`.run.app`-URL topology as **protocol-viable but not production-acceptable as-is**: it will very likely work in a browser with default, unrestricted third-party-cookie settings, and will very likely silently fail the refresh flow in Safari, in any browser's private/incognito mode, and in an increasing share of default Chrome/Firefox configurations as third-party-cookie restrictions continue to tighten. This is a real, user-visible availability gap (silent logout/refresh failure), not a security hole, but it is not acceptable to ship without a stronger topology and without having actually tested it on target browsers.

Recommended stronger topology, in order of preference:

1. **Same-origin proxy/gateway** (a single public hostname that routes `/api/*` to the backend service and everything else to the frontend service). This removes the cross-origin request entirely for every cookie-bearing call - no CORS, no `SameSite` question, no third-party-cookie classification, because the browser never makes a cross-origin request in the first place. Strongest and simplest guarantee; the real cost is standing up and operating a proxy component this architecture does not currently have.
2. **Sibling custom domains under one shared parent** (e.g. `app.workboard.example` and `api.workboard.example`), with the refresh cookie's `Domain` attribute explicitly set to the shared parent (`Domain=workboard.example`). Browsers classify `SameSite` by registrable site (eTLD+1), not by exact hostname, so this makes the cookie genuinely first-party in every browser, including Safari's strict ITP - no third-party-cookie exposure at all. Real cost: owning and provisioning TLS for a real domain instead of relying on Cloud Run's free default URLs.
3. **Keep the current two-independent-`*.run.app`-URL topology only with explicit, tested acceptance of its limitation** - acceptable only as a disclosed training/demo state, never as the production decision, since it leaves session persistence dependent on browser privacy settings this project does not control.

## Consequences

Positive:

- The `Lax` → `None`+`Secure` fix from Module 15 remains correct and necessary regardless of which option above is chosen - it is a prerequisite for options 1-3, not an alternative to them.
- Naming the actual mechanism (site classification, not raw hostname; CORS and cookie policy as separate browser subsystems) makes the real risk precise instead of a vague "cross-domain cookies are hard" concern.

Negative:

- No option above has been validated against a live deployment yet - this ADR is reasoned from the committed workflow and documentation plus Module 15's real, disclosed local-HTTPS testing gap, not from a real browser session against genuinely deployed Cloud Run URLs.
- A same-origin proxy or custom domains are both real infrastructure additions beyond what Terraform currently provisions in `infrastructure/gcp/terraform/` - neither is built as of this entry.

## Production direction

Before real production acceptance: stand up one of the two stronger topologies above, then perform the actual browser-based verification the workshop step names explicitly - login, refresh after access-token expiry, logout, expired/invalid refresh, and privacy/incognito-mode behavior - on the real target domains, not just a passing `curl` smoke check. Do not treat a green smoke-check run as evidence this gap is closed.
