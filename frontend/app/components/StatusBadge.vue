<script setup lang="ts">
const props = defineProps<{ status: TaskStatus }>()

const labels: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  in_progress: 'In progress',
  done: 'Done'
}
</script>

<template>
  <span class="status-badge" :class="`status-badge--${props.status}`">
    {{ labels[props.status] }}
  </span>
</template>
