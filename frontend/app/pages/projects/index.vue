<script setup lang="ts">
// Same placeholder-data approach as /dashboard - see that page's comment.
import { placeholderProjects } from '~/fixtures/placeholder-data'

const { data: projects, pending, error } = await useAsyncData('all-projects', async () => {
  await new Promise((resolve) => setTimeout(resolve, 300))
  return placeholderProjects
})

// Demo-only: the real list endpoint has no page/limit params yet (see
// docs/api-contract.md), so there's nothing real to paginate. This proves
// Pagination.vue actually renders and responds to clicks rather than
// leaving it untested until a later module wires real pagination.
const demoPage = ref(1)
const demoTotalPages = 3

useSeoMeta({ title: 'Projects — Workboard' })
</script>

<template>
  <div>
    <h1>Projects</h1>
    <p class="page-note">
      Placeholder data - not yet backed by a real session. Module 11 replaces this
      with the authenticated <code>GET /api/v1/projects</code> call.
    </p>

    <LoadingIndicator v-if="pending" label="Loading projects…" />
    <ErrorAlert v-else-if="error" :message="error.message" title="Could not load projects" />
    <p v-else-if="!projects || projects.length === 0">No projects to show yet.</p>
    <div v-else class="card-grid">
      <ProjectCard v-for="project in projects" :key="project.id" :project="project" />
    </div>

    <p class="page-note">
      Pagination demo (not wired to real data - see component comment):
    </p>
    <PaginationControls v-model:current-page="demoPage" :total-pages="demoTotalPages" />
  </div>
</template>
