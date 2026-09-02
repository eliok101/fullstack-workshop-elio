export default defineNuxtConfig({
  compatibilityDate: '2026-07-01',
  devtools: { enabled: false },
  modules: ['@nuxt/eslint', '@pinia/nuxt'],
  // Real bug, found live on the deployed site and confirmed on two separate
  // swr routes ('/' and the long-standing '/public/projects/**'): with
  // payload extraction on (Nuxt's default whenever any route is
  // prerendered/cached), a cached route's hydration payload ships as a
  // separate `_payload.json` fetch (confirmed directly: the response's
  // `#__NUXT_DATA__` script tag carries a `data-src` pointing at that file
  // instead of the JSON inline) rather than embedded in the initial HTML.
  // The client mounts once that separate fetch resolves, and every real
  // browser test against the live production build (never reproducible in
  // dev, which doesn't extract payloads at all) showed a real "Hydration
  // completed but contains mismatches" warning as a result. Functionally
  // harmless here - Vue recovers and every real user flow tested clean
  // regardless - but real and worth removing outright. Extraction exists so
  // a prerendered page's client-side navigation can fetch just its data
  // from static hosting with no live server behind it; this app is never
  // statically hosted; it always runs behind a live Nitro server on Cloud
  // Run, so the tradeoff extraction exists for buys nothing here.
  experimental: { payloadExtraction: false },
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
    // Real production bug, found live on the deployed Cloud Run frontend and
    // confirmed by curling the live homepage: `prerender: true` bakes the
    // page's runtime-config hydration payload once at `nuxt build` time -
    // before NUXT_PUBLIC_API_BASE is known, since that's only set later, as
    // a Cloud Run env var at deploy time (.github/workflows/deploy-gcp.yml).
    // The live home page's HTML had apiBase frozen at its
    // http://localhost:8000/api/v1 build-time default as a result. Every
    // visitor lands on '/' first, and frontend/app/plugins/api.ts only calls
    // useRuntimeConfig() once, at client boot - so every subsequent
    // client-side action for the rest of that browser session (Sign up,
    // Log in, the background auth/refresh check) silently reused that same
    // wrong, unreachable-from-the-browser base URL. Real impact: account
    // creation and session refresh were completely broken for every real
    // visitor. swr re-renders from the live server - picking up its
    // correctly-overridden runtime config - at most once a minute instead of
    // freezing forever at build time, the same mechanism already proven
    // below for public project pages, so the home page keeps almost all of
    // prerender's speed without ever serving a build-time-stale apiBase.
    '/': { swr: 60 },
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
