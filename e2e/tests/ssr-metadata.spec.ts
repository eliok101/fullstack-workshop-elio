import { test, expect } from '@playwright/test'
import { apiBaseURL } from '../playwright.config'
import { uniqueEmail, uniqueProjectName } from '../fixtures/unique-data'
import { registerUser, loginUser, createProjectViaApi } from '../fixtures/api-client'

/**
 * Proves the public project page is genuinely server-rendered, building on
 * Module 12's manual curl verification by making the same claim an
 * automated, repeatable test: a raw HTTP GET (Playwright's request context,
 * which never executes JavaScript) must already contain the real content in
 * the response body. If this page were client-fetch-only, the raw HTML
 * would contain only a loading placeholder and every assertion below would
 * fail - that's the specific thing this test is checking, not just "the
 * page eventually shows the right text in a browser" (which a CSR-only page
 * would also pass).
 */
test.describe('public project SSR metadata', () => {
  test('raw HTTP response already contains title, heading, and content - no client fetch required', async ({
    request,
    baseURL
  }) => {
    const email = uniqueEmail('ssr')
    const user = { email, password: 'ssr-pass-123', fullName: 'SSR Tester' }
    await registerUser(request, apiBaseURL, user)
    const token = await loginUser(request, apiBaseURL, email, user.password)
    const projectName = uniqueProjectName('SSR Project')
    const project = await createProjectViaApi(request, apiBaseURL, token, projectName, true)

    const response = await request.get(`${baseURL}/public/projects/${project.slug}`)
    expect(response.status()).toBe(200)
    const html = await response.text()

    expect(html).toContain(`<title>${projectName} — Workboard</title>`)
    expect(html).toContain(`>${projectName}<`)
    expect(html).toContain('0 of 0 tasks complete.')
  })

  test('real browser navigation shows the same server-rendered content', async ({ page, request }) => {
    const email = uniqueEmail('ssr-browser')
    const user = { email, password: 'ssr-pass-123', fullName: 'SSR Browser Tester' }
    await registerUser(request, apiBaseURL, user)
    const token = await loginUser(request, apiBaseURL, email, user.password)
    const projectName = uniqueProjectName('SSR Browser Project')
    const created = await createProjectViaApi(request, apiBaseURL, token, projectName, true)

    await page.goto(`/public/projects/${created.slug}`)
    await expect(page).toHaveTitle(`${projectName} — Workboard`)
    await expect(page.getByRole('heading', { level: 1, name: projectName })).toBeVisible()
  })
})
