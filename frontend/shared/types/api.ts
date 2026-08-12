/**
 * TypeScript mirror of the backend's Pydantic schemas (see
 * backend/app/schemas/*.py and docs/api-contract.md). Field names and
 * optionality are kept in lockstep with the real API contract on purpose -
 * these types exist to catch a frontend/backend field mismatch at compile
 * time, not to describe an idealized shape.
 *
 * Important limitation: these are compile-time-only assertions. Nothing here
 * validates that JSON actually arriving over the network matches - a backend
 * bug, a contract drift, or a network proxy rewriting a response would still
 * produce a value TypeScript happily treats as a `User` even if it isn't
 * one. `as`/generic casts on fetch responses are a promise, not a proof.
 * Runtime validation (e.g. a schema-parsing library at the fetch boundary)
 * is the only way to actually close that gap, and is out of scope here.
 *
 * Timestamps are typed `string`, not `Date`: JSON has no date type, so a
 * `created_at` value arrives as an ISO 8601 string and stays a string until
 * something explicitly parses it - typing it `Date` would be a lie the
 * compiler couldn't catch.
 */

export type TaskStatus = 'backlog' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface User {
  id: number
  email: string
  full_name: string
  is_active: boolean
  created_at: string
}

export interface Project {
  id: number
  name: string
  slug: string
  description: string | null
  is_public: boolean
  owner_id: number
  created_at: string
  updated_at: string
}

export interface ProjectPublicSummary {
  name: string
  slug: string
  description: string | null
  task_count: number
  completed_task_count: number
}

export interface Task {
  id: number
  project_id: number
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  assignee_id: number | null
  due_date: string | null
  created_at: string
  updated_at: string
}

export interface AuthTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

/** Request bodies - kept separate from the *Read types because create/update
 * payloads are intentionally narrower (e.g. no server-assigned `id`). */
export interface UserRegisterRequest {
  email: string
  full_name: string
  password: string
}

export interface ProjectCreateRequest {
  name: string
  description?: string | null
  is_public?: boolean
}

export interface TaskCreateRequest {
  title: string
  description?: string | null
  priority?: TaskPriority
  assignee_id?: number | null
  due_date?: string | null
}

export interface TaskUpdateRequest {
  title?: string
  description?: string | null
  status?: TaskStatus
  priority?: TaskPriority
  assignee_id?: number | null
  due_date?: string | null
}

/** Matches the domain error body documented in docs/api-contract.md - every
 * non-validation domain failure (409, 404, 401, ...) has this exact shape. */
export interface ApiErrorBody {
  detail: string
  code: string
}
