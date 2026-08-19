import { test, expect } from '@playwright/test'
import { uniqueEmail, uniqueProjectName } from '../fixtures/unique-data'
import { gotoHydrated } from '../fixtures/hydration'

/**
 * The one full, real, entirely browser-driven journey named by Module 15's
 * lab (register through protected-navigation-after-logout). Deliberately
 * the only test in the suite that drives every step through the UI rather
 * than the API - this is exactly the journey the API-setup helpers
 * (fixtures/api-client.ts) are NOT used for, since driving registration,
 * login, project/task creation, and status transitions through real forms
 * and clicks is the user behavior this test exists to prove.
 */
test('register, manage a project through task completion, sign out', async ({ page }) => {
  const email = uniqueEmail('journey')
  const password = 'journey-pass-123'
  const projectName = uniqueProjectName('Journey Project')
  const taskTitle = 'Write the release notes'

  // 1. Register
  await gotoHydrated(page, '/register')
  await page.getByLabel('Full name').fill('Journey Tester')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByText(`Account created for ${email}.`)).toBeVisible()

  // Log in (registration does not itself sign the user in). Scoped to the
  // main landmark, not the header nav: the success message's own inline
  // "Log in to continue" link and the header's guest-state "Log in" link
  // both share the accessible name "Log in" - a real locator ambiguity, not
  // a hypothetical one (Playwright's strict mode caught it immediately).
  await page.getByRole('main').getByRole('link', { name: 'Log in' }).click()
  await page.waitForURL('**/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()

  // 2. Verify protected projects page - login redirects to /dashboard
  await page.waitForURL('**/dashboard')
  await expect(page.getByRole('heading', { name: 'Your projects' })).toBeVisible()

  // 3. Create a public project
  await page.getByRole('link', { name: 'Projects' }).click()
  await page.waitForURL('**/projects')
  await page.getByLabel('Project name').fill(projectName)
  await page.getByLabel('Make this project public').check()
  await page.getByRole('button', { name: 'Create project' }).click()
  const projectLink = page.getByRole('link', { name: projectName })
  await expect(projectLink).toBeVisible()

  // 4. Open project
  await projectLink.click()
  await expect(page.getByRole('heading', { level: 1, name: projectName })).toBeVisible()

  // 5. Create a task
  await page.getByLabel('New task title').fill(taskTitle)
  await page.getByRole('button', { name: 'Add task' }).click()
  const taskCard = page.getByRole('article').filter({ hasText: taskTitle })
  await expect(taskCard).toBeVisible()
  await expect(taskCard.getByText('Backlog', { exact: true })).toBeVisible()

  // 6. Move backlog -> in progress -> done
  await taskCard.getByRole('button', { name: 'Advance' }).click()
  await expect(taskCard.getByText('In progress', { exact: true })).toBeVisible()
  await taskCard.getByRole('button', { name: 'Advance' }).click()
  await expect(taskCard.getByText('Done', { exact: true })).toBeVisible()

  // 7. Verify visible state - Advance is now disabled, matching the
  // backend's real terminal-state rule (app/services/task_transitions.py)
  await expect(taskCard.getByRole('button', { name: 'Advance' })).toBeDisabled()

  // 9. Sign out - deliberately before step 8's public-page visit, and via
  // the header's real "Log out" button (client-side, no page.goto), not
  // after one: the access token lives only in an in-memory Pinia ref (by
  // design - see stores/auth.ts), so any full page load, including a
  // `page.goto()` to the public page, tears it down. Real, reproduced
  // finding: session restoration on such a reload depends on the httpOnly
  // refresh cookie, which the backend sets `SameSite=Lax` outside
  // production - Lax cookies are never attached to a cross-site fetch(),
  // and frontend-test/backend-test are genuinely different hostnames here
  // (unlike the dev stack's shared `localhost`), so the refresh silently
  // fails and the "still-authenticated" assumption a same-hostname-only test
  // could get away with does not hold. Signing out first, over a real client
  // click, tests the actual documented sign-out control without depending on
  // a cross-host cookie mechanism this local HTTP stack cannot exercise at
  // all (SameSite=None, the real fix, requires HTTPS - see
  // backend/app/api/routes/auth.py's _set_refresh_cookie comment).
  await page.getByRole('button', { name: 'Log out' }).click()
  await page.waitForURL('**/login')

  // 8. Open public page - real navigation, real SSR-backed content, not an
  // API assertion (see ssr-metadata.spec.ts for the dedicated SSR proof).
  // No auth needed - deliberately run after sign-out now.
  const slug = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  await page.goto(`/public/projects/${slug}`)
  await expect(page.getByRole('heading', { level: 1, name: projectName })).toBeVisible()
  await expect(page.getByText('1 of 1 tasks complete.')).toBeVisible()

  // 10. Verify protected navigation returns to login - already signed out
  // above, so this proves the middleware redirect, not just a side effect
  // of the earlier reload.
  await page.goto('/dashboard')
  await page.waitForURL('**/login**')
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible()
})
