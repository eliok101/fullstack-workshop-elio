<script setup lang="ts">
const { data, error } = await useFetch<{ status: string }>('/api/health')

useSeoMeta({
  title: 'Workboard — project and task tracker',
  description:
    'Workboard is the full-stack intern workshop capstone: an authenticated, tested, deployed project and task tracker.'
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
      <p v-if="data" class="success">
        Backend reachable via server-side render: {{ data.status }}
      </p>
      <p v-else class="error">Backend health check failed: {{ error?.message }}</p>
    </section>
  </div>
</template>
