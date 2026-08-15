<script setup lang="ts">
// Step 4: this page is prerendered (routeRules['/'].prerender in
// nuxt.config.ts) - real HTML is generated once, at build time, not per
// request. A useFetch call here would be baked into that static output
// forever: "Backend reachable via server-side render: alive" would keep
// showing even during a real outage, and a build-time backend hiccup would
// freeze a false "unreachable" message into every future page load until
// the next deploy. { server: false } makes this a client-only check instead
// - it runs fresh in the visitor's own browser after hydration, so the
// status shown is always current, at the cost of a brief loading state
// before it resolves. The hero content above it (name, description, CTAs)
// has no such per-request dependency and is exactly what should be
// prerendered.
const { data, error, status } = await useFetch<{ status: string }>('/api/health', {
  server: false
})

useSeoMeta({
  title: 'Workboard — project and task tracker',
  description:
    'Workboard is the full-stack intern workshop capstone: an authenticated, tested, deployed project and task tracker.',
  ogTitle: 'Workboard — project and task tracker',
  ogDescription:
    'Workboard is the full-stack intern workshop capstone: an authenticated, tested, deployed project and task tracker.',
  ogType: 'website'
})
</script>

<template>
  <div class="home">
    <section class="hero">
      <p class="eyebrow">Full-stack intern workshop capstone</p>
      <h1>Workboard</h1>
      <p class="lede">
        Workboard is a project and task tracker built module by module: a FastAPI
        backend with real authentication and authorization, a Nuxt frontend, and a
        PostgreSQL database, tested and deployed like a real product rather than a
        classroom exercise.
      </p>
      <div class="hero__actions">
        <NuxtLink to="/register" class="button button--primary">
          Create an account
        </NuxtLink>
        <NuxtLink to="/login" class="button button--secondary">Log in</NuxtLink>
      </div>
    </section>

    <section class="status" aria-label="Service status">
      <!--
        status === 'idle' matters here for the same reason it did in
        dashboard.vue (Module 11): with server: false, the prerendered/SSR
        pass never starts this fetch at all, so pending is false and status
        is 'idle' at that point, not "checked and failed." Checking only
        `data`/`error` would render the error branch on every prerendered
        load, permanently, until the client-side fetch actually resolves.
      -->
      <LoadingIndicator v-if="status === 'idle' || status === 'pending'" label="Checking backend status…" />
      <p v-else-if="data" class="success">
        Backend reachable: {{ data.status }}
      </p>
      <p v-else class="error">Backend health check failed: {{ error?.message }}</p>
    </section>
  </div>
</template>
