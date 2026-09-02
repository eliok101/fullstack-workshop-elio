/**
 * Route protection for /dashboard and /projects*, plus keeping an already
 * signed-in user off /login and /register. Global (runs on every
 * navigation) rather than per-page definePageMeta, so a new protected route
 * is covered by default instead of requiring every page to remember to
 * opt in.
 *
 * Skips entirely on the server: the baseline has no SSR-authenticated
 * fetch (see the module's own "avoid hydration mismatch" instruction and
 * app/plugins/auth.client.ts), so the server never actually knows real auth
 * state - guessing there would either wrongly redirect an authenticated
 * user's first request or, worse, let a protected page render with no
 * guard at all. The client pass below is the one that actually decides.
 *
 * Awaits initAuth() itself (not just trusting the plugin already ran) so
 * this is correct regardless of whether the plugin's own call has resolved
 * yet by the time this fires - initAuth() is idempotent, so this never
 * double-fires the refresh request.
 */
const PROTECTED_PREFIXES = ['/dashboard', '/projects']
const GUEST_ONLY_PATHS = ['/login', '/register']

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return

  const auth = useAuthStore()
  await auth.initAuth()

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => to.path === prefix || to.path.startsWith(`${prefix}/`)
  )
  if (isProtected && !auth.isAuthenticated) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }

  // Real bug, found live and root-caused with Vue's dev-mode hydration
  // diagnostics: /login and /register always render as SSR guest pages (see
  // the "Skips entirely on the server" note above), so an already
  // authenticated visitor hard-landing on one of them has a real,
  // server-sent DOM to hydrate first. Redirecting immediately here, on the
  // very first client navigation, changes the router's target to /dashboard
  // *before* Vue finishes hydrating the page the server actually sent - Vue
  // then hydrates /dashboard's expected content against /register's real
  // DOM nodes. Text/attribute mismatches from that are silently never
  // corrected in production ("this mismatch is check-only... will not be
  // rectified in production" - Vue's own warning), which is exactly why the
  // header's Dashboard/Projects links kept the stale /login//register hrefs
  // forever, confirmed live. PROTECTED_PREFIXES above doesn't need this
  // same guard: /dashboard and /projects are ssr:false (routeRules), so
  // there is never any real server-rendered content for a redirect away
  // from them to conflict with. Deferring just this direction until
  // hydration has actually finished lets the guest page hydrate honestly
  // against what the server really sent - a clean, mismatch-free hydration
  // - before this then runs as a completely normal, real client-side
  // navigation. nuxtApp.isHydrating is the same flag Nuxt's own router
  // plugin checks around middleware-driven navigation during hydration.
  if (GUEST_ONLY_PATHS.includes(to.path) && auth.isAuthenticated) {
    const nuxtApp = useNuxtApp()
    if (nuxtApp.isHydrating) {
      // The hook callback must return HookResult (void), not navigateTo()'s
      // own return value - unlike the middleware's own return below, this
      // fires well after the current navigation has already resolved, so
      // there is nothing here for Nuxt's router to act on.
      nuxtApp.hooks.hookOnce('app:suspense:resolve', () => {
        navigateTo('/dashboard')
      })
      return
    }
    return navigateTo('/dashboard')
  }
})
