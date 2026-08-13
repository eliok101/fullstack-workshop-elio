/**
 * Attempts the silent refresh/load-current-user exactly once per app load,
 * client-only. `.client` suffix means this never runs during SSR, so the
 * server always renders with status 'initializing' and the client resolves
 * it after hydration - no server/client mismatch to reconcile, at the cost
 * of every hard reload paying one refresh round trip before the real auth
 * state is known. That tradeoff is the module's own explicit instruction
 * ("keeping private pages client-authenticated in the baseline").
 */
export default defineNuxtPlugin(async () => {
  const auth = useAuthStore()
  await auth.initAuth()
})
