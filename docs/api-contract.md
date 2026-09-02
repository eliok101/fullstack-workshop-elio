# API contract

Base path: `/api/v1`

Interactive OpenAPI documentation is served at `/docs` in the reference configuration. Treat the generated schema as a reviewable contract, not a substitute for explicit behavior and error documentation.

## Conventions

- JSON request and response bodies use `snake_case` to match Python schemas.
- Dates are ISO `YYYY-MM-DD`; timestamps are ISO 8601 UTC values.
- Protected endpoints require `Authorization: Bearer <access-token>`.
- Validation failures use FastAPI's structured `422` response.
- Domain failures use a consistent body:

```json
{
  "detail": "Human-readable message",
  "code": "stable_machine_code"
}
```

- Delete operations return `204 No Content`.
- Access tokens are returned in JSON. Refresh tokens are HTTP-only cookies scoped to `/api/v1/auth`.

## Health and service status

### `GET /health`

Checks process and database in one endpoint. Useful for manual inspection, not a substitute for separate liveness/readiness probes.

### `GET /health/live`

Returns `200` when the application process can serve requests. It does not query the database.

### `GET /health/ready`

Executes a database probe. A failed dependency should make the service unready without causing a restart loop solely because PostgreSQL is temporarily unavailable.

### `GET /api/v1/status`

Returns service name, version, and environment. Do not add secret/config values.

## Authentication

### `POST /api/v1/auth/register`

Request:

```json
{
  "email": "intern@example.com",
  "full_name": "Workshop Intern",
  "password": "StrongPassword123!"
}
```

Response: `201` with the public user representation. Duplicate email returns `409`.

### `POST /api/v1/auth/login`

Content type: `application/x-www-form-urlencoded`

```text
username=intern@example.com&password=StrongPassword123!
```

Response:

```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "expires_in": 900
}
```

Also sets an HTTP-only refresh cookie. Invalid credentials return `401` without identifying whether the email exists.

### `POST /api/v1/auth/refresh`

Reads the refresh cookie and returns a new access token. The reference does not rotate or revoke refresh tokens; production extension work must address that threat model.

### `POST /api/v1/auth/logout`

Deletes the refresh cookie and returns a message. Because the reference has no server-side revocation list, logout does not invalidate an already issued access token before expiry.

### `GET /api/v1/auth/me`

Returns the authenticated user.

## Projects

### `GET /api/v1/projects`

Lists projects visible to the authenticated user through ownership or membership, ordered newest-first, paginated. Query params: `page` (default `1`, minimum `1`), `page_size` (default `20`, `1`-`100`).

Response:

```json
{
  "items": [{ "id": 1, "name": "Intern workboard", "slug": "intern-workboard", "description": "Capstone delivery plan", "is_public": true, "owner_id": 1, "created_at": "...", "updated_at": "..." }],
  "total": 1,
  "page": 1,
  "page_size": 20,
  "total_pages": 1
}
```

### `POST /api/v1/projects`

Request:

```json
{
  "name": "Intern workboard",
  "description": "Capstone delivery plan",
  "is_public": true
}
```

Creates a project, generates a unique slug, and creates owner membership. Response: `201`.

### `GET /api/v1/projects/{project_id}`

Returns a visible project or `404`. Resource-scoped `404` avoids confirming private resource existence to unauthorized users.

### `PATCH /api/v1/projects/{project_id}`

Updates supplied fields. Only authorized users may update. The reference service limits destructive decisions to the owner.

### `DELETE /api/v1/projects/{project_id}`

Deletes the project and dependent records according to model/database cascade behavior. Response: `204`.

### `GET /api/v1/projects/public/{slug}`

Unauthenticated endpoint for a public project summary. Returns project metadata plus task and completed-task counts. Private or missing slugs return `404`.

## Tasks

Task endpoints are nested under a project to preserve resource context:

```text
/api/v1/projects/{project_id}/tasks
```

### `GET /api/v1/projects/{project_id}/tasks`

Lists tasks for a visible project.

### `POST /api/v1/projects/{project_id}/tasks`

Request:

```json
{
  "title": "Add migration test",
  "description": "Build a clean database in CI",
  "priority": "high",
  "assignee_id": null,
  "due_date": "2026-07-30"
}
```

New tasks begin in `backlog`. Response: `201`.

### `PATCH /api/v1/projects/{project_id}/tasks/{task_id}`

Supports partial updates. Status values:

```text
backlog → in_progress → done
```

The reference intentionally rejects `backlog → done` so the learner has a concrete domain rule to unit-test. Moving backward is not supported in the baseline.

### `DELETE /api/v1/projects/{project_id}/tasks/{task_id}`

Deletes the task after project authorization. Response: `204`.

## Error/status matrix

| Condition | Status | Stable code example |
|---|---:|---|
| Invalid schema/body | 422 | FastAPI validation structure |
| Missing/invalid/expired access token | 401 | `unauthorized` |
| Authenticated but action forbidden | 403 or resource-scoped 404 | `forbidden` |
| Missing or inaccessible resource | 404 | `not_found` |
| Duplicate email/slug conflict | 409 | `conflict` |
| Invalid task transition | 409 | `invalid_transition` |
| Unexpected server failure | 500 | generic response; detail in logs only |

## Manual request file

Use [../examples/http/workboard.http](../examples/http/workboard.http) with an editor REST client, or translate each request to `curl`. Do not paste real production tokens into committed files.

## Contract change procedure

1. state backward-compatibility and client impact;
2. update Pydantic schemas and OpenAPI expectations;
3. update service behavior and tests;
4. update frontend TypeScript contracts and handling;
5. update this document and HTTP examples;
6. consider API versioning for breaking changes;
7. deploy compatible database changes before incompatible application changes.
