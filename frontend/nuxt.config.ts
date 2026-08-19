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
    //
    // Deliberately a plain literal, not `process.env.X || default`: Nuxt's own
    // runtime-config-from-env mechanism already overrides this key at server
    // startup from `NUXT_API_INTERNAL_BASE` (its real naming convention -
    // NUXT_ + SCREAMING_SNAKE_CASE of the key path - confirmed against
    // .github/workflows/deploy-gcp.yml, which has always set exactly that
    // name for the deployed Cloud Run frontend). A manual `process.env.X`
    // read here only works when nuxt.config.ts itself gets re-evaluated at
    // process start (true for the dev server), not for a production Nitro
    // build, where this module only runs once during `nuxt build` and the
    // expression's result is frozen into the built server bundle - any env
    // var read this way reflects build time, not the running container.
    // Real, reproduced impact before this fix: every server-rendered public
    // project page 500'd in the production build (compose.test.yaml's
    // frontend-test, and would have in real Cloud Run deployment too) with
    // "fetch failed" against the wrong host, despite the correct value being
    // set under the wrong env var name the whole time.
    apiInternalBase: 'http://backend:8000/api/v1',
    public: {
      // Shipped into the client bundle and readable by anyone viewing the page
      // source - the browser calls the backend directly at this address, so it
      // must be a real, publicly reachable base URL, never a secret or an
      // internal-only Docker hostname the browser can't resolve.
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8000/api/v1',
      // Module 12: origin used to build canonical links and absolute
      // sitemap.xml <loc> entries. There is no deployed custom domain yet
      // (docs/accessibility-and-seo.md: "Plan canonical URL once a stable
      // public domain exists") - this defaults to the local dev origin so
      // the mechanism is real and testable today, and becomes correct in
      // production purely by setting NUXT_PUBLIC_SITE_URL, no code change.
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    }
  },
  typescript: {
    strict: true,
    typeCheck: true
  },
  // Module 12 build investigation: a clean `docker build --target production`
  // (see frontend/Dockerfile) 500s on every route that needs Vue SSR -
  // "Cannot find module '/app/server/node_modules/vue/index.mjs'". Root
  // cause, confirmed by inspecting the packaged image directly: Nitro's
  // node-server preset traces which files from node_modules actually need
  // to ship alongside the server bundle (rather than shipping all of
  // node_modules) and copies only those. It correctly detects that
  // vue/server-renderer is imported directly, but vue/server-renderer's own
  // internal import of the base vue runtime is resolved in a way the tracer
  // doesn't follow, so vue's own index.mjs/dist never get copied - the
  // package.json makes it in, the code it points to doesn't. Forcing these
  // two into the server bundle itself (rather than left as external files
  // the tracer must separately copy) sidesteps the gap entirely.
  nitro: {
    externals: { inline: ['vue', 'vue/server-renderer'] }
  },
  routeRules: {
    // Step 4: the home page has no per-user data - safe to generate once at
    // build time instead of on every request.
    '/': { prerender: true },
    // Step 4: public project content changes independently of any deploy
    // (task counts move as tasks change), so it can't be prerendered like
    // home - but it also isn't volatile enough to need a fresh render on
    // literally every hit. swr: 60 serves a cached response instantly and
    // revalidates in the background at most once a minute; see Step 4's log
    // entry for what this means when the backend is down.
    '/public/projects/**': { swr: 60 },
    // Step 1/4: genuinely protected, always-live, single-user data with no
    // crawlability requirement - true client rendering (no SSR HTML at all)
    // removes any hydration-mismatch surface for these routes entirely,
    // rather than relying on an SSR'd loading shell plus client-only data
    // fetch. See the Step 1 route table for the full reasoning.
    '/dashboard': { ssr: false },
    '/dashboard/**': { ssr: false },
    '/projects': { ssr: false },
    '/projects/**': { ssr: false }
  }
})
