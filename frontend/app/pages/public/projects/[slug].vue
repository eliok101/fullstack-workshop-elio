<script setup lang="ts">
// GET /api/v1/projects/public/{slug} requires no authentication (see
// docs/api-contract.md), so unlike /dashboard and /projects this page keeps
// its SSR fetch instead of going through the auth-gated $api client -
// there's no session to wait on.
//
// This page renders during SSR, so it must use the private apiInternalBase
// (Docker DNS `backend:8000`) when running server-side and the public
// apiBase (`localhost:8000`) when running client-side - `localhost` inside
// the frontend *container* resolves to the container itself, not the
// backend, so using the public base unconditionally here would fail during
// SSR. This is exactly the split Step 2 set up in nuxt.config.ts.
const route = useRoute()
const config = useRuntimeConfig()
const apiBase = import.meta.server ? config.apiInternalBase : config.public.apiBase
const slug = route.params.slug as string

const { data, pending, error } = await useFetch<ProjectPublicSummary>(
  `${apiBase}/projects/public/${slug}`
)

useSeoMeta({
  title: () => (data.value ? `${data.value.name} — Workboard` : 'Project — Workboard')
})
</script>

<template>
  <div>
    <LoadingIndicator v-if="pending" label="Loading project…" />
    <ErrorAlert
      v-else-if="error"
      :message="extractErrorDetail(error, 'This project is private or does not exist.')"
      title="Project not found"
    />
    <template v-else-if="data">
      <h1>{{ data.name }}</h1>
      <p v-if="data.description">{{ data.description }}</p>
      <p class="page-note">
        {{ data.completed_task_count }} of {{ data.task_count }} tasks complete.
      </p>
    </template>
  </div>
</template>
