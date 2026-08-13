export default defineNuxtConfig({
  compatibilityDate: '2026-07-01',
  devtools: { enabled: false },
  modules: ['@nuxt/eslint', '@pinia/nuxt'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    // Server-only: used by Nuxt's own server-side rendering process to reach the
    // backend over the Docker Compose network (service DNS name), never sent to
    // the browser. Falls back to the same Docker DNS name used in compose.yaml
    // so `nuxt typecheck`/local tooling has a sane default outside Compose.
    apiInternalBase: process.env.NUXT_INTERNAL_API_BASE || 'http://backend:8000/api/v1',
    public: {
      // Shipped into the client bundle and readable by anyone viewing the page
      // source - the browser calls the backend directly at this address, so it
      // must be a real, publicly reachable base URL, never a secret or an
      // internal-only Docker hostname the browser can't resolve.
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8000/api/v1'
    }
  },
  typescript: {
    strict: true,
    typeCheck: true
  }
})
