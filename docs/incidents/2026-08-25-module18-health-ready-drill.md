# Incident review: Module 18 deliberate `/health/ready` failure drill

- Date/time and timezone: real impact 2026-08-25 21:01 UTC through real confirmed recovery 2026-08-27 ~12:18 UTC. All times below are UTC.
- Duration: ~1 day 15 hours real elapsed wall-clock time from impact start to confirmed recovery. This does **not** reflect detection-to-decision speed - see Technical cause and What made response harder.
- Severity: this was a deliberate, pre-planned training drill, not a genuine production incident, and is not being scored on a real incident severity scale. Assessed as if it had been genuine: **Minor/Sev-3**, not Critical - see Summary for why.
- Services/users affected: `workboard-api`'s `/health/ready` and `/health` endpoints only. `/health/live` and `workboard-web` (frontend) were unaffected throughout. This is a training deployment with no real end users; real product traffic (`/api/v1/*`) was confirmed, by direct log inspection, to never have touched the broken revision at all.
- Incident lead: Elio Kassab (learner), with Claude Code as the implementing/investigating agent for this module.

## Summary

A deliberate, pre-designed code change (Module 18's own required drill) made `workboard-api`'s readiness check unconditionally return `503`, then deployed it to real production via the normal CI/CD pipeline, to exercise the Step 3 alert and the real rollback procedure. The drill worked exactly as designed: `/health/ready` and `/health` returned real `503` in production; `/health/live` stayed `200`; the Step 3 5xx alert's underlying metric condition was genuinely crossed multiple times; the deploy pipeline's own smoke check failed as a direct result.

One claim made during planning needs correcting here rather than left standing: it was stated that "real traffic shifts to the broken revision... so real users are already affected regardless of the smoke check's outcome." Direct log inspection of every request the broken revision (`workboard-api-00004-xtq`) ever received shows only three real paths were ever hit across its whole lifetime: `/health`, `/health/live`, `/health/ready`. No real product endpoint was ever touched. `deploy-gcp.yml` also configures no custom Cloud Run readiness/startup probe pointing at `/health/ready` (confirmed by re-reading the workflow - no `--readiness-probe`/`--startup-probe` flag is set on either `gcloud run deploy` call), so Cloud Run's own instance-traffic-eligibility was never gated on this endpoint either. The accurate statement: this drill broke a **monitoring/orchestration signal**, not the product itself. That is still a real, serious class of problem - a genuine version of this bug would leave a real on-call blind to actual service health, and any *external* system that does gate on this endpoint (a load balancer health check, an uptime monitor, a future Kubernetes-style readiness gate) would have been genuinely affected - but it is a materially different, smaller blast radius than "users are affected," and the severity assessment above reflects the corrected picture, not the original overstated one.

## Detection

In a real, unplanned version of this failure, detection would be the Step 3 alert (`workboard-api-5xx-alert`, count >= 1 real 5xx per 60s) firing on real user-facing 5xx traffic. In this drill, detection was direct and immediate by design (the failure was pre-announced and deployed deliberately), but the alert's real underlying condition was independently confirmed to have been genuinely crossed: `run.googleapis.com/request_count` filtered to `response_code_class="5xx"` on `workboard-api` showed non-zero real counts in 4 of the 6 real minutes checked during the deploy window (2, 5, 0, 1, 0, 3). Email delivery of the actual notification was not independently confirmed - no access to the configured inbox from this environment, and no gcloud/REST command was found that lists fired incidents directly, only policy configuration. Named as a real, disclosed gap, not assumed closed.

## Timeline

| Time (UTC) | Observation/action/decision |
|---|---|
| 2026-08-25 20:54:06 | Tag `v1.0.0-module18-drill` pushed; `deploy-gcp.yml` run `32898005778` triggered |
| 2026-08-25 20:56:05 | Migration job execution `workboard-migrate-n6j6x` ran (real, but a no-op - no migration files changed by this drill) |
| 2026-08-25 21:01:01 | Revision `workboard-api-00004-xtq` deployed and begins receiving 100% real traffic - real impact start |
| 2026-08-25 21:01-21:07 | Real 5xx traffic recorded per-minute (2, 5, 0, 1, 0, 3); smoke-check step retries `/health/ready` (`--retry 8 --retry-all-errors`) |
| 2026-08-25 21:07:00 | Workflow run `32898005778` concludes `conclusion: failure` (smoke check exhausted its retries) |
| 2026-08-27 11:39:00 | Direct re-verification: `/health/ready` and `/health` still real `503`; `/health/live` still real `200` - break confirmed still live, over a day later |
| 2026-08-27 ~12:00-12:18 | Real rollback executed: `rollback.sh workboard-api workboard-api-00002-tmq` |
| 2026-08-27 12:18:00 | First real request to `workboard-api-00002-tmq` since the drill began (2 requests, matching the 2 post-rollback verification curls exactly) - real, confirmed recovery |

## Technical cause

`backend/app/api/routes/health.py`'s `get_database_ready()` was changed to unconditionally `raise HTTPException(503, "database unavailable")` instead of calling the real `database_is_ready()` check. `/health/ready` and `/health` both depend on this function via FastAPI's `Depends()`, so both began failing; `/health/live` does not depend on it and was unaffected by design. This is a pure application-code change - no model, migration, or schema change was involved (confirmed by `git diff` between the pre-drill and drill commits touching only this one file).

This is deliberately kept separate from the still-only-partially-explained `workboard-api-00003-fvx`/`00004-xtq` double-revision finding investigated earlier this module: that is a real, disclosed open question about the deploy pipeline's own retry behavior, evidenced by matching image digest, differing `nonce` labels, and sequential `configurationGeneration`, but it is not the root cause of this incident and should not be conflated with it. The root cause of the actual failure is the `health.py` change alone.

## Response and recovery

Mitigation was a Cloud Run traffic rollback (`gcloud run services update-traffic workboard-api --to-revisions workboard-api-00002-tmq=100`, via the repo's own `rollback.sh`), not a forward code fix - matching the rollback decision threshold written down before the drill was deployed. Recovery was verified directly, not assumed from the rollback command's own reported output: real `curl` checks showed `/health/ready` and `/health` returning `200`, and `gcloud run services describe --format="value(status.traffic)"` independently confirmed 100% real traffic on `workboard-api-00002-tmq`.

## What worked

- The rollback decision threshold, written down before deploying, required no real judgment call once revisited - the drill was already fully diagnosed, so execution was immediate.
- Cloud Run traffic rollback needed no rebuild, no new migration, and no data was touched at any point - the mechanism worked exactly as designed for this class of failure.
- The Step 3 alert's underlying metric condition was independently, directly confirmed to have been crossed, not just assumed from the policy being `enabled: true`.
- The drill's blast radius stayed exactly as designed: `/health/live` never failed, and - now directly confirmed - no real product endpoint was ever touched by the broken revision.

## What made response harder

- The real ~1 day 15 hour gap between impact start and rollback was caused entirely by elapsed real time between conversation turns (the session was not continuously attended), not by any technical or decision-making delay. A real, generalizable lesson: a written rollback threshold only shortens the *decision* step; it does nothing to shorten the *time until someone is actually looking*, which is exactly what a real, working alert notification (not just a correctly-configured alert policy) is supposed to solve - and this drill could not fully verify that last link (see Detection).
- No real timestamp was captured at the moment the rollback command was actually run, which made reconstructing the real recovery time after the fact require indirect evidence (per-revision request-count metrics) rather than a direct record - a real, avoidable process gap, not a data gap.
- Downloading the migration job's raw execution logs and the deploy job's raw step logs both hit real, disclosed access limits (empty results under every resource-type/label combination tried for the former; a real `403 Must have admin rights to Repository` for the latter) - conclusions in this module rest on circumstantial-but-strong evidence in a few places instead of a single direct log line, because of tooling/access gaps, not because the evidence wasn't sought.

## Corrective actions

| Action | Owner | Due | Verification |
|---|---|---|---|
| Capture a real timestamp immediately before/after any state-changing rollback command, rather than reconstructing it after the fact from metrics | Elio Kassab | Next real incident/drill | Reviewed at next Module 18-style exercise |
| Independently verify the Step 3 alert's actual notification delivery (check the configured inbox, or find a real API path to list fired incidents), not just the policy's `enabled` flag or its underlying metric condition | Elio Kassab | Before relying on this alert in a real incident | Confirmed email/incident evidence added to this review or a follow-up |
| Add a real test that exercises `get_database_ready()`'s actual function body (not just the FastAPI dependency override the current suite uses), so a change like this drill's would fail CI on its own merits | Elio Kassab | Before Module 19 | New test added and shown failing against the drill's diff, passing against the real code |
| Extend the app's `X-Request-ID` middleware so the ID is actually attached to structured log output, not only echoed on the response header, so real request-level log correlation does not have to fall back to Cloud Run's own `trace` field | Elio Kassab | Nice-to-have, not blocking | Manually verified a request's `X-Request-ID` value appears in its own log entry |

## Learning

The most transferable lesson from this drill is procedural, not technical: a written rollback threshold and a correctly-configured alert only shorten the steps that happen *after* a human is actually looking. Neither one shortens the time between "this broke" and "someone noticed" - that gap is what a real, verified-delivered notification is for, and this drill could not fully close the loop on verifying that (see Detection, What made response harder). A second, closely related lesson: "traffic shifted to the new revision" is not the same claim as "real users are affected" - this module's own evidence showed the drill's real blast radius was confined to health/monitoring endpoints specifically, because nothing else was actually exercising the broken revision. Precise scoping of impact, checked against real log evidence rather than assumed from the deploy mechanism alone, materially changes the correct severity assessment.
