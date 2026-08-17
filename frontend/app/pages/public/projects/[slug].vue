<script setup lang="ts">
// GET /api/v1/projects/public/{slug} requires no authentication (see
// docs/api-contract.md), so unlike /dashboard and /projects this page keeps
// its SSR fetch instead of going through the auth-gated $api client -
// there's no session to wait on.
//
// This page renders during SSR, so it must use the private apiInternalBase
// (Docker DNS `backend:8000`) when running server-side and the public
// apiBase (`localhost:8000`) when running client-side - `localhost` inside
// the frontend *container* resolves to the container itself, not the
// backend, so using the public base unconditionally here would fail during
// SSR. This is exactly the split Step 2 set up in nuxt.config.ts.
const route = useRoute()
const config = useRuntimeConfig()
const apiBase = import.meta.server ? config.apiInternalBase : config.public.apiBase
const slug = route.params.slug as string

const { data, pending, error } = await useFetch<ProjectPublicSummary>(
  `${apiBase}/projects/public/${slug}`
)

// Step 2: the backend already returns a real 404 for a missing or private
// slug (get_public_project_summary raises NotFoundError either way, so this
// page can't tell "missing" from "private" apart - by design, so an
// unauthorized visitor can't distinguish the two and infer a private
// project's existence). Before this, the page rendered the same ErrorAlert
// UI but the outer HTTP response stayed 200 - a soft-404: search engines
// would index a dead page, and anything checking status codes rather than
// reading body text would wrongly treat it as success. setResponseStatus
// only affects the server-rendered response (a no-op after hydration, which
// is fine - the status code for this navigation was already sent), so the
// friendly ErrorAlert UI is unchanged; only the wire-level status changes.
if (import.meta.server && error.value) {
  setResponseStatus(error.value.statusCode ?? 404)
}

const description = computed(() =>
  data.value?.description?.trim() ||
  (data.value ? `${data.value.name}: ${data.value.completed_task_count} of ${data.value.task_count} tasks complete.` : undefined)
)
const canonicalUrl = computed(() => `${config.public.siteUrl}/public/projects/${slug}`)

useSeoMeta({
  title: () => (data.value ? `${data.value.name} — Workboard` : 'Project not found — Workboard'),
  description,
  ogTitle: () => (data.value ? `${data.value.name} — Workboard` : undefined),
  ogDescription: description,
  ogType: 'website',
  ogUrl: () => (data.value ? canonicalUrl.value : undefined),
  twitterCard: 'summary',
  // Step 3: a missing/private slug already returns a real 404 above, but a
  // 404 page can still get crawled/cached before it 404s again later - an
  // explicit noindex is a second, independent signal against indexing a
  // dead URL, not a substitute for the real status code.
  robots: () => (data.value ? undefined : 'noindex, nofollow')
})

useHead({
  link: [{ rel: 'canonical', href: () => (data.value ? canonicalUrl.value : undefined) }]
})
</script>

<template>
  <div>
    <LoadingIndicator v-if="pending" label="Loading project…" />
    <ErrorAlert
      v-else-if="error"
      :message="extractErrorDetail(error, 'This project is private or does not exist.')"
      title="Project not found"
    />
    <template v-else-if="data">
      <h1>{{ data.name }}</h1>
      <p v-if="data.description">{{ data.description }}</p>
      <p class="page-note">
        {{ data.completed_task_count }} of {{ data.task_count }} tasks complete.
      </p>
    </template>
  </div>
</template>
