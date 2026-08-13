<script setup lang="ts">
withDefaults(defineProps<{ message: string; title?: string }>(), {
  title: 'Something went wrong'
})
</script>

<template>
  <div class="error-alert" role="alert">
    <p class="error-alert__title">{{ title }}</p>
    <p class="error-alert__message">{{ message }}</p>
  </div>
</template>
