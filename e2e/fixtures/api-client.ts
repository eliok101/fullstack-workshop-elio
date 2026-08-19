import type { APIRequestContext } from '@playwright/test'

/**
 * Thin wrappers around Playwright's own request context for the real,
 * deployed API - used only for setup/assertions that are explicitly not the
 * behavior under test (docs/testing-strategy.md: "Prefer public APIs for
 * setup when the UI behavior is not under test... Do not bypass the browser
 * for the user behavior the test is supposed to prove"). Never used as a
 * substitute for driving the browser in the critical journey test itself.
 */

export interface RegisteredUser {
  email: string
  password: string
  fullName: string
}

export async function registerUser(
  request: APIRequestContext,
  apiBaseURL: string,
  user: RegisteredUser
) {
  const response = await request.post(`${apiBaseURL}/auth/register`, {
    data: { email: user.email, full_name: user.fullName, password: user.password }
  })
  if (!response.ok()) {
    throw new Error(`registerUser failed: ${response.status()} ${await response.text()}`)
  }
  return response.json()
}

export async function loginUser(
  request: APIRequestContext,
  apiBaseURL: string,
  email: string,
  password: string
): Promise<string> {
  // The real login endpoint takes OAuth2PasswordRequestForm
  // (application/x-www-form-urlencoded), not JSON - see
  // backend/app/api/routes/auth.py.
  const response = await request.post(`${apiBaseURL}/auth/login`, {
    form: { username: email, password }
  })
  if (!response.ok()) {
    throw new Error(`loginUser failed: ${response.status()} ${await response.text()}`)
  }
  const body = await response.json()
  return body.access_token as string
}

export async function createProjectViaApi(
  request: APIRequestContext,
  apiBaseURL: string,
  accessToken: string,
  name: string,
  isPublic = false
) {
  const response = await request.post(`${apiBaseURL}/projects`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: { name, description: null, is_public: isPublic }
  })
  if (!response.ok()) {
    throw new Error(`createProjectViaApi failed: ${response.status()} ${await response.text()}`)
  }
  return response.json()
}

export async function createTaskViaApi(
  request: APIRequestContext,
  apiBaseURL: string,
  accessToken: string,
  projectId: number,
  title: string
) {
  const response = await request.post(`${apiBaseURL}/projects/${projectId}/tasks`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: { title }
  })
  if (!response.ok()) {
    throw new Error(`createTaskViaApi failed: ${response.status()} ${await response.text()}`)
  }
  return response.json()
}
