import { test, expect } from '@playwright/test'
import { apiBaseURL } from '../playwright.config'
import { uniqueEmail, uniqueProjectName } from '../fixtures/unique-data'
import { registerUser, loginUser, createProjectViaApi, createTaskViaApi } from '../fixtures/api-client'

/**
 * Module 15 Step 5, deliberately through Playwright's API request context
 * and NOT the UI: the UI never exposes a backlog->done control at all (see
 * TaskCard.vue's nextStatus map), so this specifically protects the real
 * deployed acceptance-stack API boundary (production images, real
 * PostgreSQL, the actual InvalidTransitionError handler in
 * backend/app/main.py) against ever being bypassed by a client that isn't
 * this UI - a genuinely different risk than the backend's own unit/
 * integration tests, which exercise the same rule in-process against
 * SQLite/a directly-instantiated app, never through the real deployed HTTP
 * boundary this suite runs against.
 */
test('backend rejects a backlog-to-done transition with a stable 409', async ({ request }) => {
  const email = uniqueEmail('invalid-transition')
  const user = { email, password: 'transition-pass-123', fullName: 'Transition Tester' }
  await registerUser(request, apiBaseURL, user)
  const token = await loginUser(request, apiBaseURL, email, user.password)
  const project = await createProjectViaApi(request, apiBaseURL, token, uniqueProjectName('Transition Project'))
  const task = await createTaskViaApi(request, apiBaseURL, token, project.id, 'Skip the queue')

  expect(task.status).toBe('backlog')

  const response = await request.patch(`${apiBaseURL}/projects/${project.id}/tasks/${task.id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { status: 'done' }
  })

  expect(response.status()).toBe(409)
  const body = await response.json()
  expect(body.code).toBe('invalid_transition')
})
