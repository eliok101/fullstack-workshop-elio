import { test, expect } from '@playwright/test'
import { uniqueEmail } from '../fixtures/unique-data'
import { gotoHydrated } from '../fixtures/hydration'
import { apiBaseURL } from '../playwright.config'

/**
 * Regression test for a real production incident: every real visitor lands
 * on '/' first, and '/' carries a routeRules cache rule (prerender, then
 * swr - see nuxt.config.ts) rather than plain per-request SSR. A cached
 * render's hydration payload embeds whatever NUXT_PUBLIC_API_BASE the
 * *rendering* request resolved - it is not guaranteed to be current the
 * instant a *browser* later hydrates against it, and frontend/app/plugins/api.ts
 * only reads useRuntimeConfig() once, at client boot. Clicking "Create an
 * account" from the home page is a client-side <NuxtLink> transition, not a
 * fresh page load, so whatever apiBase the home page hydrated with is what
 * every subsequent request reuses for the rest of that browser session.
 *
 * The bug this once let through: nuxt.config.ts's public.apiBase default
 * was a plain `process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8000/api/v1'`
 * expression, frozen into a prerendered '/' at `nuxt build` time - before
 * the real env var is ever set (that only happens later, as a Cloud Run
 * `--set-env-vars` flag at deploy time). Confirmed live: `curl` against the
 * deployed homepage showed `apiBase:"http://localhost:8000/api/v1"` baked
 * into its HTML, and every real registration attempt failed with a CORS
 * error, because it targeted the browser's own localhost instead of the
 * real backend. compose.test.yaml's frontend-test service reproduces the
 * same shape of gap (NUXT_PUBLIC_API_BASE is only set as a *container* env
 * var, never present during the image's `docker build`), which is what
 * makes this catchable here rather than only in production.
 *
 * Every other test in this suite reaches /register or /login via
 * gotoHydrated (a fresh full page load), which always gets a live,
 * correctly-configured render and would never have caught this - the home
 * page's own client-only health check (index.vue's `/api/health` fetch)
 * also stays green throughout, since it calls a same-origin Nitro server
 * route rather than the public apiBase, so it gives no warning either. This
 * test is deliberately the one path through the suite that enters via '/'
 * and navigates by clicking, matching how a real visitor actually arrives.
 */
test('registering after landing on the home page hits the real backend, not localhost', async ({ page }) => {
  const email = uniqueEmail('home-entry')
  const password = 'home-entry-pass-123'

  // 1. Land on the home page first - the real, cached/prerendered route.
  await gotoHydrated(page, '/')

  // 2. Follow the real call to action via a client-side transition, exactly
  // as a real visitor would - not page.goto('/register').
  await page.getByRole('link', { name: 'Create an account' }).click()
  await page.waitForURL('**/register')
  await page.getByLabel('Full name').fill('Home Entry Tester')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)

  // 3. Capture the actual outgoing request rather than only the UI outcome:
  // a same-origin, CORS-blocked request can still leave the "Create
  // account" button looking like it did something, so asserting on visible
  // success/failure text alone would not pin down *where* the request went.
  const [registerRequest] = await Promise.all([
    page.waitForRequest((req) => req.url().includes('/auth/register') && req.method() === 'POST'),
    page.getByRole('button', { name: 'Create account' }).click()
  ])

  expect(new URL(registerRequest.url()).origin).toBe(new URL(apiBaseURL).origin)
  await expect(page.getByText(`Account created for ${email}.`)).toBeVisible()
})
