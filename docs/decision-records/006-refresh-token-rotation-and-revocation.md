# ADR 006: Refresh token rotation, reuse detection, and session revocation

- Status: Proposed (design-only - implementation is out of cohort scope per Module 08's independent challenge)
- Date: 2026-08-10

## Context

The current baseline (Module 08, see [ADR 005](005-jwt-access-and-cookie-refresh.md)) issues long-lived refresh tokens with no rotation, reuse detection, or revocation mechanism. As documented in Module 08's threat notes, a stolen refresh token grants an attacker indefinite access (until natural expiry) with no way for the server to distinguish attacker use from legitimate use.

## Decision

### Data model

Add a new table, `refresh_sessions`:

- `id` (primary key)
- `user_id` (foreign key to `users`)
- `token_hash` (SHA-256 hash of the refresh token's unique identifier - NEVER store the raw token, matching the same "never store recoverable secrets" principle as password hashing)
- `issued_at`, `expires_at`
- `revoked_at` (nullable - null means active)
- `replaced_by_id` (nullable foreign key to this same table - links a rotated-out session to its successor, forming a chain)

Each refresh token's JWT payload includes a `session_id` (a UUID) claim in addition to `sub` and `type` - this ties the stateless JWT to a specific stateful database row, which is what makes revocation possible at all (a pure stateless JWT cannot be revoked before its own expiry by definition).

### Rotation

On every successful `/auth/refresh` call:

1. Look up the `refresh_sessions` row by `session_id` from the token.
2. If `revoked_at` is not null, this token has already been used or revoked - see Reuse detection below.
3. Otherwise: mark the current row `revoked_at = now`, create a NEW `refresh_sessions` row (new `session_id`, new token), set the old row's `replaced_by_id` to the new row's `id`, issue a new refresh token JWT containing the new `session_id`, set it as the new `HttpOnly` cookie.

This means each refresh token is single-use - presenting the same refresh token twice will always fail the second time, since the first use immediately revokes it.

### Reuse detection

If a refresh token is presented whose `session_id` maps to a row where `revoked_at` is already set, this is evidence of compromise: either the legitimate user's browser retried a request, or an attacker is using a stolen, already-rotated-out token. Since legitimate retries are rare and this system doesn't distinguish them from compromise (accepting some false-positive risk in exchange for security), the correct response is to treat this as compromise: revoke the ENTIRE chain of sessions reachable from this one (walk `replaced_by_id` forward, and also revoke backward via a reverse lookup or a shared `family_id` column), effectively logging the user out of every device, and returning 401 with a generic message (per the frontend-safe error principle from Step 7 - never reveal "reuse detected" explicitly to the client).

### Concurrency

Two near-simultaneous refresh requests with the same valid token racing against each other need atomicity - the "look up, check `revoked_at`, revoke, create new row" sequence must happen inside a single database transaction with row-level locking (`SELECT ... FOR UPDATE` on the `refresh_sessions` row) to prevent both requests from seeing `revoked_at = null` and both succeeding, which would defeat single-use rotation. This directly reuses the transaction-atomicity discipline established in Module 06.

### Logout

Explicit logout should revoke the specific `refresh_sessions` row (set `revoked_at = now`), not just clear the cookie client-side as the current baseline does - this closes the gap noted in Step 9 where logout doesn't actually invalidate anything server-side.

### Expiry

`expires_at` on `refresh_sessions` should match the JWT's own `exp` claim, checked redundantly at the database level - this means even a correctly-signed, non-expired-per-JWT token can still be rejected if the database row has independently expired or been revoked, giving the server authoritative control that a pure stateless JWT design cannot provide alone.

### Compromise response (full account compromise, not just one session)

A separate, heavier action - "revoke all sessions for this user" (`UPDATE refresh_sessions SET revoked_at = now WHERE user_id = ? AND revoked_at IS NULL`) - should be available for account-recovery flows (e.g. after a password reset), distinct from the automatic single-chain revocation triggered by reuse detection.

## Consequences

Positive:

- Closes the "stolen refresh token grants indefinite access" gap identified in Module 08's threat notes.
- Reuse detection turns a stolen-token event into a detectable, contained incident rather than silent, indefinite compromise.
- Logout becomes a genuine server-side control instead of a client-side-only cookie clear.
- Gives the server authoritative revocation control that a pure stateless JWT design cannot provide alone.

Negative:

- Adds one additional database table and one additional query per refresh call (acceptable cost for the security gained).
- Requires the transaction-locking discipline from Module 06 to avoid a race condition undermining single-use rotation.
- Does not fully solve the problem of a stolen ACCESS token (still valid until natural short expiry) - this ADR only addresses the refresh-token layer, consistent with Step 9's threat notes distinguishing the two token types' different risk profiles.
- Legitimate network retries could trigger false-positive full-chain revocation; this is an accepted tradeoff favoring security over convenience for this design, and could be refined later with a short grace-period window if false positives prove disruptive in practice.

## Tests that would be required for a real implementation

- Rotation: using a refresh token successfully invalidates it for any subsequent use.
- Reuse detection: presenting an already-rotated-out token revokes the entire session chain and returns a generic 401.
- Concurrency: two simultaneous requests with the same valid refresh token result in exactly one success and one rejection, never two successes (requires a real concurrency test, not just sequential calls).
- Logout: explicitly revokes the specific session server-side, verified by confirming a subsequent refresh attempt with the same token fails even though the cookie was never inspected client-side.
- Expiry: a database-revoked-but-JWT-still-valid token is rejected (proving the database check is genuinely enforced, not redundant/unreachable).

## Production direction

Implement behind a feature flag once a real threat model and platform are chosen. Evaluate whether a managed identity provider's built-in session/revocation handling would replace this design entirely before building it in-house, per the same evaluation discipline used in [ADR 005](005-jwt-access-and-cookie-refresh.md)'s "Production direction."
