<script setup lang="ts">
// Static links for now: every visitor sees the same nav regardless of auth
// state, because no auth composable/store exists yet (Module 11 wires real
// session state). Login/Register vs. Dashboard/Projects will become
// conditional once that lands - documented as a known, deliberate gap.
</script>

<template>
  <header class="app-header">
    <div class="app-header__inner">
      <NuxtLink to="/" class="app-header__brand">Workboard</NuxtLink>
      <nav class="app-header__nav" aria-label="Main">
        <NuxtLink to="/dashboard">Dashboard</NuxtLink>
        <NuxtLink to="/projects">Projects</NuxtLink>
        <NuxtLink to="/login">Log in</NuxtLink>
        <NuxtLink to="/register" class="app-header__cta">Sign up</NuxtLink>
      </nav>
    </div>
  </header>
</template>
