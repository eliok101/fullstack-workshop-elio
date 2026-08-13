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

  if (GUEST_ONLY_PATHS.includes(to.path) && auth.isAuthenticated) {
    return navigateTo('/dashboard')
  }
})
