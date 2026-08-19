import { test, expect } from '@playwright/test'
import { apiBaseURL } from '../playwright.config'
import { uniqueEmail, uniqueProjectName } from '../fixtures/unique-data'
import { registerUser, createProjectViaApi, loginUser } from '../fixtures/api-client'
import { gotoHydrated } from '../fixtures/hydration'

/**
 * The specific responsive risk this protects: `main.css` has exactly one
 * mobile-specific rule in the whole app -
 * `@media (max-width: 640px) { .app-header__inner { flex-direction: column } }`
 * - which switches the header from a row (brand + nav side by side) to a
 * stacked column below 640px, presumably so the nav links don't overlap or
 * get clipped on a real phone-width screen. Nothing in the desktop suite
 * (which always runs at a >640px viewport) can ever exercise that
 * breakpoint, so a regression that removed or broke that rule would be
 * invisible to every other test in this suite. This test's real job is
 * proving the header stays usable at that width, not "does mobile work in
 * general" - registration, sign-out, and status transitions are already
 * protected at desktop width (critical-journey.spec.ts) and aren't a
 * distinct responsive risk, so they're deliberately not repeated here.
 *
 * Project setup goes through the API (not the behavior under test, same
 * reasoning as invalid-transition.spec.ts); login and task creation go
 * through the real mobile-viewport UI, since those are exactly what's under
 * test here.
 */
test('header navigation and task creation remain usable at a mobile viewport', async ({ page, request }) => {
  const email = uniqueEmail('mobile')
  const password = 'mobile-pass-123'
  await registerUser(request, apiBaseURL, { email, password, fullName: 'Mobile Tester' })
  const token = await loginUser(request, apiBaseURL, email, password)
  const project = await createProjectViaApi(request, apiBaseURL, token, uniqueProjectName('Mobile Project'))

  await gotoHydrated(page, '/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await page.waitForURL('**/dashboard')

  // Confirms the breakpoint is actually active for this viewport, not just
  // assumed from the CSS source - the real computed style after layout.
  const headerInner = page.locator('.app-header__inner')
  await expect(headerInner).toHaveCSS('flex-direction', 'column')

  // Every nav destination stays genuinely reachable (visible and clickable)
  // in the stacked layout, not just present in the DOM.
  await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible()
  const projectsLink = page.getByRole('link', { name: 'Projects' })
  await expect(projectsLink).toBeVisible()
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible()

  await projectsLink.click()
  await page.waitForURL('**/projects')
  await page.getByRole('link', { name: project.name }).click()
  await expect(page.getByRole('heading', { level: 1, name: project.name })).toBeVisible()

  // Task creation at mobile width
  const taskTitle = 'Confirm mobile task creation works'
  await page.getByLabel('New task title').fill(taskTitle)
  await page.getByRole('button', { name: 'Add task' }).click()
  await expect(page.getByRole('article').filter({ hasText: taskTitle })).toBeVisible()
})
