<script setup lang="ts">
// Real backend call: GET /api/v1/projects, authenticated via the $api
// client's bearer attachment. server: false because this route is
// client-authenticated only in the baseline (see middleware/auth.global.ts
// and app/plugins/auth.client.ts) - the SSR pass renders only the loading
// state below, never real data, so there's nothing to leak to an
// unauthenticated request.
const api = useProjectsApi()

const { data: projects, pending, status, error } = await useAsyncData(
  'dashboard-projects',
  () => api.listProjects(),
  { server: false }
)

// Step 3/Step 1 table: protected, single-user, always-live data with no
// crawlability requirement - noindex is defense in depth even though the
// route is also unreachable pre-auth and now renders client-only (ssr:false
// in nuxt.config.ts), so there is no server-rendered HTML for a crawler to
// see here regardless.
useSeoMeta({ title: 'Dashboard — Workboard', robots: 'noindex, nofollow' })
</script>

<template>
  <div>
    <h1>Your projects</h1>

    <!--
      status === 'idle' matters as much as pending here: with server: false,
      the SSR pass never starts the fetch at all, so pending is false and
      status is 'idle' at that point - not "loaded and empty." Checking
      pending alone was a real bug (fixed after curling this page and
      finding "You don't have any projects yet" rendered for every visitor,
      logged in or not, before the real request had even been sent).
    -->
    <LoadingIndicator v-if="pending || status === 'idle'" label="Loading your projects…" />
    <ErrorAlert v-else-if="error" :message="error.message" title="Could not load projects" />
    <p v-else-if="!projects || projects.length === 0">You don't have any projects yet.</p>
    <div v-else class="card-grid">
      <ProjectCard v-for="project in projects" :key="project.id" :project="project" />
    </div>
  </div>
</template>
