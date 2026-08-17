<script setup lang="ts">
const props = defineProps<{ task: Task }>()
const emit = defineEmits<{
  advance: [taskId: number]
  delete: [taskId: number]
}>()

// The backend rejects any transition once a task is `done` (see
// app/services/task_transitions.py) - disabling here mirrors that rule so
// the button never invites a click the API would reject anyway. This is a
// UX courtesy, not the enforcement point: the backend remains the real
// authority regardless of what this component allows the user to attempt.
const canAdvance = computed(() => props.task.status !== 'done')
</script>

<template>
  <article class="task-card">
    <div class="task-card__header">
      <!-- h3: the only current usage is under /projects/[id]'s "Tasks" h2. -->
      <h3 class="task-card__title">{{ task.title }}</h3>
      <StatusBadge :status="task.status" />
    </div>
    <p class="task-card__priority">Priority: {{ priorityLabel(task.priority) }}</p>
    <p v-if="task.description" class="task-card__description">
      {{ task.description }}
    </p>
    <div class="task-card__actions">
      <button
        type="button"
        :disabled="!canAdvance"
        @click="emit('advance', task.id)"
      >
        Advance
      </button>
      <button
        type="button"
        class="task-card__delete"
        @click="emit('delete', task.id)"
      >
        Delete
      </button>
    </div>
  </article>
</template>
