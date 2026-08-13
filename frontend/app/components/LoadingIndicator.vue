<script setup lang="ts">
withDefaults(defineProps<{ label?: string }>(), { label: 'Loading…' })
</script>

<template>
  <p class="loading-indicator" role="status" aria-live="polite">
    <span class="loading-indicator__spinner" aria-hidden="true" />
    {{ label }}
  </p>
</template>
