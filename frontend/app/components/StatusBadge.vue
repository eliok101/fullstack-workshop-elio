<script setup lang="ts">
const props = defineProps<{ status: TaskStatus }>()
</script>

<template>
  <span class="status-badge" :class="`status-badge--${props.status}`">
    {{ statusLabel(props.status) }}
  </span>
</template>
