<script setup lang="ts">
defineProps<{ project: Project }>()
</script>

<template>
  <article class="project-card">
    <!-- h2: every current usage places this card directly under a page h1
         with no intervening section heading. A `level` prop would be
         needed if a future page nests it deeper - not added speculatively. -->
    <h2 class="project-card__title">
      <NuxtLink :to="`/projects/${project.id}`">{{ project.name }}</NuxtLink>
    </h2>
    <p v-if="project.description" class="project-card__description">
      {{ project.description }}
    </p>
    <p class="project-card__meta">
      <span>{{ project.is_public ? 'Public' : 'Private' }}</span>
    </p>
  </article>
</template>
