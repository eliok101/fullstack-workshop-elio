<script setup lang="ts">
const auth = useAuthStore()
const nuxtApp = useNuxtApp()

// Real bug, found live and confirmed with Vue's dev-mode hydration trace: the
// server always renders this header logged-out (auth.global.ts's middleware
// deliberately never checks real auth server-side), but auth.isAuthenticated
// is a live, reactive binding straight to the store - if initAuth() (kicked
// off by both app/plugins/auth.client.ts and auth.global.ts's own middleware,
// which the middleware runs and awaits *before* this component even mounts)
// resolves before Vue's hydration comparison reaches this template, the
// v-if/v-else branch Vue expects on the client already disagrees with what
// the server actually sent - a real "Log in"/"Sign up" -> "Dashboard"/
// "Projects" text and href mismatch that production Vue documents it will
// never correct. Same fix shape as the redirect in auth.global.ts: hold this
// template at the server's actual (logged-out) branch through the first
// hydration pass - a clean, honest hydration, since both sides agree at that
// exact moment - then switch to the real, live value once hydration has
// genuinely finished, and stay reactive to it from then on.
const showAuthenticated = ref(false)
if (import.meta.client) {
  const sync = () => {
    showAuthenticated.value = auth.isAuthenticated
  }
  if (nuxtApp.isHydrating) {
    nuxtApp.hooks.hookOnce('app:suspense:resolve', () => {
      sync()
      watch(() => auth.isAuthenticated, sync)
    })
  } else {
    sync()
    watch(() => auth.isAuthenticated, sync)
  }
}

async function handleLogout() {
  await auth.logout()
  await navigateTo('/login')
}
</script>

<template>
  <header class="app-header">
    <div class="app-header__inner">
      <NuxtLink to="/" class="app-header__brand">Workboard</NuxtLink>
      <nav class="app-header__nav" aria-label="Main">
        <template v-if="showAuthenticated">
          <NuxtLink to="/dashboard">Dashboard</NuxtLink>
          <NuxtLink to="/projects">Projects</NuxtLink>
          <button type="button" class="app-header__logout" @click="handleLogout">Log out</button>
        </template>
        <template v-else>
          <NuxtLink to="/login">Log in</NuxtLink>
          <NuxtLink to="/register" class="app-header__cta">Sign up</NuxtLink>
        </template>
      </nav>
    </div>
  </header>
</template>
