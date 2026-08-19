import type { Page } from '@playwright/test'

/**
 * Navigates to a fresh page load and waits for Vue hydration to actually
 * finish before returning - reproduced, real issue: clicking a submit
 * button immediately after `page.goto()` resolves (Playwright's default
 * 'load' wait) can win the race against Nuxt's client bundle hydrating,
 * since the button is already visible/interactive in the server-rendered
 * HTML but its `@submit.prevent` handler isn't wired up yet. The click then
 * falls through to a native browser form submission (a full-page GET reload
 * with no `name` attributes to serialize, so it reloads the same URL) and
 * silently discards all component state.
 *
 * `waitForLoadState('networkidle')` alone is not a reliable proxy for this:
 * it measures network quiescence, not JS execution, and a *production*
 * bundle (one small minified client-entry script) can finish loading over
 * the network well before Vue actually finishes parsing and mounting it -
 * confirmed by reproducing this exact failure against the containerized
 * production build (compose.test.yaml) even with the networkidle wait in
 * place, after it had already made the *dev* server race rare enough to
 * stop reproducing in isolation. The real, deterministic signal is Vue's
 * own internal marker (an `__vue`-prefixed property Vue 3 attaches to its
 * mount target once mounted - the same property Vue Devtools relies on),
 * polled here rather than assumed to exist by a fixed point in time.
 */
export async function gotoHydrated(page: Page, path: string) {
  await page.goto(path)
  await page.waitForFunction(() => {
    const el = document.getElementById('__nuxt')
    return !!el && Object.keys(el).some((k) => k.startsWith('__vue'))
  })
}
