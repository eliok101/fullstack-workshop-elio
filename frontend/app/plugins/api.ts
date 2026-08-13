/**
 * Instantiates the API client once per app instance and exposes it as
 * `$api` (usable via useNuxtApp().$api, or the shared `useProjectsApi`
 * composable). Plugins run once per SSR request on the server and once on
 * client startup, so this never leaks state across unrelated requests -
 * unlike a module-level singleton would.
 *
 * Base URL selection reuses the exact split Module 10 built and proved in
 * nuxt.config.ts/public/projects/[slug].vue: apiInternalBase (Docker DNS)
 * during SSR, apiBase (public host) in the browser.
 */
import { createApiClient } from '~/utils/api-client'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()

  const client = createApiClient({
    baseURL: () => (import.meta.server ? config.apiInternalBase : config.public.apiBase),
    // Lazy lookups (not captured once at plugin-setup time): by the time an
    // actual request fires, Pinia is guaranteed active, but that isn't true
    // at plugin-registration time relative to @pinia/nuxt's own plugin.
    getAccessToken: () => useAuthStore().accessToken,
    refresh: () => useAuthStore().refresh(),
    onAuthFailure: () => useAuthStore().clearSession()
  })

  return {
    provide: { api: client }
  }
})
