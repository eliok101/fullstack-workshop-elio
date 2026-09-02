<script setup lang="ts">
// Real backend calls: GET /api/v1/projects for the list, POST /api/v1/projects
// to create - see app/composables/useProjectsApi.ts. server: false for the
// same client-authenticated-baseline reason as /dashboard.
const api = useProjectsApi()

// Real pagination state - see the removed demo note below. currentPage
// drives the actual request; total-pages/total come back from the server
// on every response instead of being assumed, so a project created or
// deleted while paging is always reflected correctly.
const currentPage = ref(1)

const { data: response, pending, status, error, refresh } = await useAsyncData(
  'all-projects',
  () => api.listProjects({ page: currentPage.value }),
  { server: false, watch: [currentPage] }
)

const projects = computed(() => response.value?.items ?? [])
const totalPages = computed(() => response.value?.total_pages ?? 1)

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
    // New projects sort first (created_at desc) - jump back to page 1 so
    // the one just created is actually visible, rather than leaving the
    // user on whatever later page they were paging through, wondering
    // where it went. currentPage.value = 1 alone wouldn't refetch if
    // they were already on page 1, so refresh() covers that case too.
    if (currentPage.value === 1) {
      await refresh()
    } else {
      currentPage.value = 1
    }
  } catch (err) {
    createErrorMessage.value = err instanceof Error ? err.message : 'Could not create the project.'
  } finally {
    creating.value = false
  }
}

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
    <p v-else-if="response?.total === 0">No projects to show yet.</p>
    <!-- Distinct from the true-zero case above: a real, non-empty list can
         still land here if items were deleted out from under the page a
         user is currently on (e.g. their only project on page 3 got
         removed) - "no projects" would be actively wrong here since real
         projects still exist, just not on this particular page. -->
    <p v-else-if="projects.length === 0">No projects on this page.</p>
    <div v-else class="card-grid">
      <ProjectCard v-for="project in projects" :key="project.id" :project="project" />
    </div>

    <PaginationControls
      v-if="totalPages > 1"
      v-model:current-page="currentPage"
      :total-pages="totalPages"
    />
  </div>
</template>
