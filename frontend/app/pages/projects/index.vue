<script setup lang="ts">
// Real backend calls: GET /api/v1/projects for the list, POST /api/v1/projects
// to create - see app/composables/useProjectsApi.ts. server: false for the
// same client-authenticated-baseline reason as /dashboard.
const api = useProjectsApi()

const { data: projects, pending, status, error, refresh } = await useAsyncData(
  'all-projects',
  () => api.listProjects(),
  { server: false }
)

const name = ref('')
const description = ref('')
const isPublic = ref(false)
const creating = ref(false)
const createErrorMessage = ref('')

async function handleCreate() {
  if (creating.value) return // guards against a double click firing two POSTs
  creating.value = true
  createErrorMessage.value = ''
  try {
    await api.createProject({
      name: name.value,
      description: description.value || null,
      is_public: isPublic.value
    })
    name.value = ''
    description.value = ''
    isPublic.value = false
    await refresh()
  } catch (err) {
    createErrorMessage.value = err instanceof Error ? err.message : 'Could not create the project.'
  } finally {
    creating.value = false
  }
}

// Demo-only: the real list endpoint still has no page/limit params (see
// docs/api-contract.md), so there is nothing real to paginate yet - this
// only proves PaginationControls renders and its boundary logic works.
const demoPage = ref(1)
const demoTotalPages = 3

// Step 3/Step 1 table: same reasoning as dashboard.vue.
useSeoMeta({ title: 'Projects — Workboard', robots: 'noindex, nofollow' })
</script>

<template>
  <div>
    <h1>Projects</h1>

    <form class="form" novalidate @submit.prevent="handleCreate">
      <div class="form-field">
        <label for="project-name">Project name</label>
        <input id="project-name" v-model="name" type="text" required>
      </div>
      <div class="form-field">
        <label for="project-description">Description</label>
        <input id="project-description" v-model="description" type="text">
      </div>
      <div class="form-field form-field--checkbox">
        <input id="project-public" v-model="isPublic" type="checkbox">
        <label for="project-public">Make this project public</label>
      </div>
      <button type="submit" class="button button--primary" :disabled="creating">
        {{ creating ? 'Creating…' : 'Create project' }}
      </button>
      <ErrorAlert v-if="createErrorMessage" :message="createErrorMessage" title="Could not create project" />
    </form>

    <!-- status === 'idle' handling: see the same fix/comment in dashboard.vue -->
    <LoadingIndicator v-if="pending || status === 'idle'" label="Loading projects…" />
    <ErrorAlert v-else-if="error" :message="error.message" title="Could not load projects" />
    <p v-else-if="!projects || projects.length === 0">No projects to show yet.</p>
    <div v-else class="card-grid">
      <ProjectCard v-for="project in projects" :key="project.id" :project="project" />
    </div>

    <p class="page-note">
      Pagination demo (component proof only - see the comment above):
    </p>
    <PaginationControls v-model:current-page="demoPage" :total-pages="demoTotalPages" />
  </div>
</template>
