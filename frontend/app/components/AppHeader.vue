<script setup lang="ts">
const auth = useAuthStore()

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
        <template v-if="auth.isAuthenticated">
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
