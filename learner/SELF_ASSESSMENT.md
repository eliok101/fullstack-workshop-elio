# Final self-assessment

Score each statement from 1 to 4 and provide evidence.

```text
1 — I recognize the concept but need step-by-step help.
2 — I can complete the task with notes and review support.
3 — I can complete and explain the task independently.
4 — I can diagnose failures, compare alternatives, and teach the task.
```

| Capability | Score | Evidence |
|---|---:|---|
| Git branches, commits, pull requests, and review corrections | 3 | Repeated branch/commit/PR workflow across all 19 modules, resolved a real merge conflict in Module 02, identified the Module 16 branch-protection gap. Honest caveat: no external human review cycle in this workshop's format - review corrections were worked through with an AI collaborator, not equivalent evidence to defending a technical choice against independent human pushback. |
| HTTP semantics and API contracts | 4 | Module 03's full success/error-status matrices and idempotency reasoning across all four HTTP verbs; correctly distinguished Google-edge 404s from application-level failures during Module 17/18 teardown verification. |
| FastAPI routing, dependencies, validation, and errors | 4 | Built the Module 05 domain exception hierarchy; caught and corrected a health-check regression mid-refactor; replaced FAKE_CURRENT_USER_ID with the real current-user dependency system in Module 08, making the security rule explicit and testable at the route boundary. |
| Relational modeling, SQLAlchemy, transactions, and Alembic | 4 | Found and fixed the Module 06 missing-ENUM-downgrade defect; proved transaction atomicity against a real foreign-key violation; diagnosed and fixed the Module 15 connection-pool staleness bug through three controlled, sequential experiments. |
| Authentication and resource authorization | 4 | Module 08's timing-attack fix, registration race-condition fix, and full authorization audit; the deployer/runtime least-privilege identity design (Module 17) demonstrating the same separation-of-duties principle at the infrastructure layer. |
| Backend unit and API testing | 4 | Module 09's risk map, 94% branch coverage, and mutation-testing drill - one mutation (missing task-update authorization) survived undetected and was correctly treated as a real test-suite gap, not just a result; also exposed a real Project/ProjectMember cascade bug. Module 19's fresh mutation drill confirms the practice transfers. |
| Vue components, Composition API, TypeScript, and Nuxt routing | 3 | Module 10's typed component shell, seven core routes, accessibility corrections, and an independently-designed pagination component with test plan. Held at 3 rather than 4: solid independent implementation, but the cited evidence doesn't yet show deep Vue/Nuxt architectural diagnosis I could confidently teach. |
| Frontend API integration and state | 4 | Module 11's shared API client with token refresh, Pinia auth store, route middleware; diagnosed a false-empty dashboard state by distinguishing loading from genuinely-empty; correctly separated a corrupted-dependency issue from an application code bug. |
| SSR, metadata, accessibility, and performance basics | 4 | Module 12's soft-404 SEO fix, plus discovering and fixing a genuine production-blocking Docker build defect with two independent root causes (missing nuxt prepare re-run; Nitro dependency-tracer gap). |
| Frontend unit, component, and API-client testing | 4 | Module 13's Vitest suite built from scratch; found a docstring-vs-reality API client defect; caught a genuine SSR/timezone hydration-mismatch bug by reasoning before writing a test; derived a transferable mutation-testing safety principle after an infinite-domain mock combined with a removed termination guard caused a real OOM crash. |
| Docker images, Compose, networking, volumes, and health | 4 | Module 04's Alpine/Debian addgroup fix; Module 14's discovery that the backend never applied migrations on startup (a severe, previously-undetected bug); proactively found and fixed a real CRLF/Windows-checkout corruption risk before it shipped. |
| Playwright API and browser acceptance testing | 4 | Module 15's real E2E suite; rejected an insufficient networkidle-based fix once production contradicted it; found and fixed three genuine production-blocking bugs (connection-pool staleness, wrong SSR env var name, SameSite=Lax cookie bug) via rigorous, independent investigation. |
| GitHub Actions quality and deployment workflows | 4 | Built the real CI pipeline with path-aware skip logic; reasoned through a subtle skip-propagation semantic before it became a bug; discovered no branch protection had ever existed, configured it for real, and watched it correctly block a real stale-lockfile bug. |
| Cloud Run, Artifact Registry, Cloud SQL, Secret Manager, IAM | 4 | Real terraform apply (34 resources) via OIDC; found and fixed a real provider-schema bug; diagnosed a genuine Cloud SQL teardown-ordering failure; recovered from a real Workload Identity Pool soft-delete conflict using GCP's proper undelete mechanism. |
| Logs, metrics, alerts, incidents, and rollback | 4 | Real baseline, a self-caught alert-filter bug, a real deliberate production failure deployed through the real pipeline, a real rollback, a real incident review - and discovering and correctly reconciling a separate parallel session's real infrastructure work before taking destructive action based on a false assumption. |
| Architecture and tradeoff communication | 4 | Defended FastAPI and Cloud Run under real, live pushback - correctly conceding valid counterpoints from alternatives (Django/DRF, Kubernetes) rather than overstating superiority, and grounding each decision in this system's actual requirements and real deployment/rollback experience. |

## Reflection

- Strongest production-ready capability: Backend architecture and testing discipline - the combination of domain-driven exception handling, dependency-injected authentication, and mutation-tested coverage that catches real regressions, not just re-runs green.
- Capability that still needs supervision: Collaborative Git workflow under real external human code review - the mechanics are solid, but defending a technical decision against independent human pushback (not an AI collaborator) is genuinely untested in this format.
- Most valuable review correction: Being pushed to re-score capabilities 6-16 using the full 19-module record instead of only the current session's directly-visible work - and separately, refusing to score capabilities without real citations rather than inventing plausible-sounding evidence.
- Most important security lesson: Deploy authority and secret-read authority are separable capabilities, and keeping them separate (the deployer/runtime identity split) limits the blast radius of a compromised CI pipeline without requiring the CI pipeline to be perfectly trustworthy.
- Most important operational lesson: A clean result from a destructive operation (like a database teardown) can be luck of an unordered dependency graph, not a fix - and a passing health check only proves the one narrow thing it actually checks, not that the product it fronts is genuinely working.
- A technical decision I would change with more time: Add expand/contract migration discipline and a real seed-data mechanism earlier, rather than repeatedly documenting their absence as a disclosed gap across multiple modules.
- My first 30-day development plan after the workshop: Use the 3 real roadmap deliverables already drafted in Module 19's risk-register work: refresh-token rotation, login rate limiting, and the CI path-filter fix closing the exact mechanism that let Module 18's drill code reach main undetected.
