<script setup lang="ts">
// Real backend calls throughout: GET project + GET tasks, POST a task,
// PATCH a task's status, DELETE a task. Unlike /dashboard and /projects
// (plain useAsyncData), this page manages loading manually with an
// AbortController - see the comment above loadProject() for why: this is
// also the module's independent challenge (stale route-data cancellation).
const route = useRoute()
const api = useProjectsApi()
const projectId = computed(() => Number(route.params.id))

const project = ref<Project | null>(null)
const tasks = ref<Task[]>([])
const pending = ref(true)
const loadErrorMessage = ref<string | null>(null)

const newTaskTitle = ref('')
const creatingTask = ref(false)
const taskActionError = ref<string | null>(null)

let activeController: AbortController | null = null

/**
 * The race this prevents: /projects/[id] reuses the same page component
 * across param changes (Vue Router doesn't remount it just because :id
 * changed), so navigating from /projects/1 to /projects/2 before project
 * 1's fetch has resolved leaves that old request in flight. Without
 * cancellation, a slow response for project 1 could resolve *after* project
 * 2's fetch already completed and overwrite the now-current page with
 * project 1's data - the URL says "2" but the screen shows "1".
 *
 * Aborting the previous controller before starting a new one turns that
 * into a real cancelled network request (the browser drops the in-flight
 * fetch outright, not just "we'll ignore whatever comes back"), and the
 * `signal.aborted` checks below make sure an abort never gets treated as a
 * user-facing load error.
 */
async function loadProject(id: number) {
  activeController?.abort()
  const controller = new AbortController()
  activeController = controller

  pending.value = true
  loadErrorMessage.value = null
  try {
    const [projectResult, tasksResult] = await Promise.all([
      api.getProject(id, controller.signal),
      api.listTasks(id, controller.signal)
    ])
    if (controller.signal.aborted) return
    project.value = projectResult
    tasks.value = tasksResult
  } catch (err) {
    if (controller.signal.aborted) return
    loadErrorMessage.value = err instanceof Error ? err.message : 'Could not load this project.'
  } finally {
    if (!controller.signal.aborted) pending.value = false
  }
}

watch(projectId, (id) => loadProject(id), { immediate: true })
onBeforeUnmount(() => activeController?.abort())

async function handleCreateTask() {
  if (creatingTask.value || !newTaskTitle.value.trim()) return
  creatingTask.value = true
  taskActionError.value = null
  try {
    const task = await api.createTask(projectId.value, { title: newTaskTitle.value.trim() })
    tasks.value = [...tasks.value, task]
    newTaskTitle.value = ''
  } catch (err) {
    taskActionError.value = err instanceof Error ? err.message : 'Could not create the task.'
  } finally {
    creatingTask.value = false
  }
}

const nextStatus: Record<TaskStatus, TaskStatus> = {
  backlog: 'in_progress',
  in_progress: 'done',
  done: 'done'
}

async function handleAdvance(taskId: number) {
  const task = tasks.value.find((t) => t.id === taskId)
  if (!task) return
  taskActionError.value = null
  try {
    // Backend is the real authority on the transition (see
    // app/services/task_transitions.py) - this sends the intended next
    // status and then replaces the local task with whatever the server
    // actually returns, rather than assuming the request applied exactly
    // as sent.
    const updated = await api.updateTask(projectId.value, taskId, { status: nextStatus[task.status] })
    tasks.value = tasks.value.map((t) => (t.id === taskId ? updated : t))
  } catch (err) {
    // A rejected transition (409 invalid_transition) or an authorization
    // failure lands here and is shown, not silently dropped - the task
    // stays exactly as the server last confirmed it.
    taskActionError.value = err instanceof Error ? err.message : 'Could not update this task.'
  }
}

async function handleDelete(taskId: number) {
  taskActionError.value = null
  try {
    await api.deleteTask(projectId.value, taskId)
    tasks.value = tasks.value.filter((t) => t.id !== taskId)
  } catch (err) {
    taskActionError.value = err instanceof Error ? err.message : 'Could not delete this task.'
  }
}

useSeoMeta({
  title: () => (project.value ? `${project.value.name} — Workboard` : 'Project — Workboard')
})
</script>

<template>
  <div>
    <LoadingIndicator v-if="pending" label="Loading project…" />
    <ErrorAlert
      v-else-if="loadErrorMessage"
      :message="loadErrorMessage"
      title="Could not load this project"
    />
    <template v-else-if="project">
      <h1>{{ project.name }}</h1>
      <p v-if="project.description">{{ project.description }}</p>

      <h2>Tasks</h2>

      <form class="form form--inline" novalidate @submit.prevent="handleCreateTask">
        <div class="form-field">
          <label for="new-task-title">New task title</label>
          <input id="new-task-title" v-model="newTaskTitle" type="text" required>
        </div>
        <button type="submit" class="button button--primary" :disabled="creatingTask">
          {{ creatingTask ? 'Adding…' : 'Add task' }}
        </button>
      </form>
      <ErrorAlert v-if="taskActionError" :message="taskActionError" title="Task action failed" />

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
