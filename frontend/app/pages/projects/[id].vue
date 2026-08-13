<script setup lang="ts">
import { placeholderProjects, placeholderTasksByProjectId } from '~/fixtures/placeholder-data'

const route = useRoute()
const projectId = computed(() => Number(route.params.id))

const { data, pending, error } = await useAsyncData(
  () => `project-${projectId.value}`,
  async () => {
    await new Promise((resolve) => setTimeout(resolve, 300))
    const project = placeholderProjects.find((p) => p.id === projectId.value)
    if (!project) {
      // A genuine, honest error case even with fixture data - visiting an
      // id that doesn't exist in the placeholder set is a real "not found",
      // not a faked failure.
      throw createError({
        statusCode: 404,
        statusMessage: `Project ${projectId.value} not found`
      })
    }
    return {
      project,
      tasks: placeholderTasksByProjectId[project.id] ?? []
    }
  },
  { watch: [projectId] }
)

// Local, mutable copy so Advance/Delete can update the UI - nothing is
// persisted to a backend yet, this is purely a client-side demonstration of
// the emitted events until Module 11 wires real PATCH/DELETE calls.
const tasks = ref<Task[]>([])
watchEffect(() => {
  tasks.value = data.value ? [...data.value.tasks] : []
})

const nextStatus: Record<TaskStatus, TaskStatus> = {
  backlog: 'in_progress',
  in_progress: 'done',
  done: 'done'
}

function handleAdvance(taskId: number) {
  const task = tasks.value.find((t) => t.id === taskId)
  if (!task) return
  task.status = nextStatus[task.status]
}

function handleDelete(taskId: number) {
  tasks.value = tasks.value.filter((t) => t.id !== taskId)
}

useSeoMeta({
  title: () => (data.value ? `${data.value.project.name} — Workboard` : 'Project — Workboard')
})
</script>

<template>
  <div>
    <LoadingIndicator v-if="pending" label="Loading project…" />
    <ErrorAlert
      v-else-if="error"
      :message="error.statusMessage || error.message || 'Unknown error'"
      title="Could not load this project"
    />
    <template v-else-if="data">
      <h1>{{ data.project.name }}</h1>
      <p v-if="data.project.description">{{ data.project.description }}</p>
      <p class="page-note">
        Advance/Delete update this page's local copy only - nothing is persisted to
        the backend yet (that's Module 11).
      </p>

      <h2>Tasks</h2>
      <p v-if="tasks.length === 0">No tasks yet.</p>
      <div v-else class="card-grid">
        <TaskCard
          v-for="task in tasks"
          :key="task.id"
          :task="task"
          @advance="handleAdvance"
          @delete="handleDelete"
        />
      </div>
    </template>
  </div>
</template>
