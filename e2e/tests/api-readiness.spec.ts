import { test, expect } from '@playwright/test'
import { apiBaseURL } from '../playwright.config'

/**
 * Runs first (alphabetically, and logically) so a stack that isn't actually
 * up yet fails here with a clear "backend/frontend not ready" message
 * instead of a confusing blank-page timeout deep inside a browser journey -
 * docs/testing-strategy.md's "readiness failures are distinguishable from
 * browser journey failures".
 */
test.describe('stack readiness', () => {
  test('backend reports ready with a database connection', async ({ request }) => {
    const backendRoot = apiBaseURL.replace(/\/api\/v1$/, '')
    const response = await request.get(`${backendRoot}/health/ready`)
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ status: 'ready' })
  })

  // Deliberately uses the plain `request` fixture, not `page`/`page.request`:
  // a readiness check is a pure HTTP call and has no reason to pay for
  // launching a real browser page just to make one.
  test('frontend reports ready', async ({ request, baseURL }) => {
    const response = await request.get(`${baseURL}/api/health`)
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ status: 'ready' })
  })
})
