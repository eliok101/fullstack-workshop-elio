<script setup lang="ts">
/**
 * Reusable previous/next pagination control. Purely presentational and
 * controlled: the parent owns the current page (v-model:currentPage) and
 * decides what "page N" means for whatever list it's paginating - this
 * component only renders controls and announces the current position.
 *
 * Unused for now: docs/api-contract.md's project/task list endpoints don't
 * accept page/limit query params yet, so there's no real paginated list to
 * attach this to. Kept ready per the module's own allowance ("may remain
 * unused until task filtering/pagination is implemented").
 */
const props = defineProps<{
  currentPage: number
  totalPages: number
}>()

const emit = defineEmits<{
  'update:currentPage': [page: number]
}>()

const isFirstPage = computed(() => props.currentPage <= 1)
const isLastPage = computed(() => props.currentPage >= props.totalPages)

function goToPrevious() {
  if (!isFirstPage.value) emit('update:currentPage', props.currentPage - 1)
}

function goToNext() {
  if (!isLastPage.value) emit('update:currentPage', props.currentPage + 1)
}
</script>

<template>
  <nav class="pagination" aria-label="Pagination">
    <button
      type="button"
      class="pagination__control"
      :disabled="isFirstPage"
      @click="goToPrevious"
    >
      <span aria-hidden="true">&larr;</span> Previous
    </button>

    <!-- role="status" + aria-live="polite": a screen reader announces the
         new page after each click without needing focus to move there. -->
    <p class="pagination__status" role="status" aria-live="polite">
      Page {{ currentPage }} of {{ totalPages }}
    </p>

    <button
      type="button"
      class="pagination__control"
      :disabled="isLastPage"
      @click="goToNext"
    >
      Next <span aria-hidden="true">&rarr;</span>
    </button>
  </nav>
</template>
