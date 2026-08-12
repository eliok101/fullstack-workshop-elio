<script setup lang="ts">
// Placeholder data pending Module 11's real auth/session + API composable
// layer - see frontend/app/fixtures/placeholder-data.ts. useAsyncData is
// used (rather than a hardcoded ref) so this page already exercises Nuxt's
// real loading/error/success async-state primitive, the same one a real
// fetch will use once the API client exists.
import { placeholderProjects } from '~/fixtures/placeholder-data'

const { data: projects, pending, error } = await useAsyncData('dashboard-projects', async () => {
  await new Promise((resolve) => setTimeout(resolve, 300))
  return placeholderProjects
})

useSeoMeta({ title: 'Dashboard — Workboard' })
</script>

<template>
  <div>
    <h1>Your projects</h1>
    <p class="page-note">
      Placeholder data - not yet backed by a real session. Module 11 replaces this
      with the authenticated <code>GET /api/v1/projects</code> call.
    </p>

    <LoadingIndicator v-if="pending" label="Loading your projects…" />
    <ErrorAlert v-else-if="error" :message="error.message" title="Could not load projects" />
    <p v-else-if="!projects || projects.length === 0">You don't have any projects yet.</p>
    <div v-else class="card-grid">
      <ProjectCard v-for="project in projects" :key="project.id" :project="project" />
    </div>
  </div>
</template>
