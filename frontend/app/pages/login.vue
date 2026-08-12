<script setup lang="ts">
const config = useRuntimeConfig()

const email = ref('')
const password = ref('')
const status = ref<'idle' | 'pending' | 'success' | 'error'>('idle')
const errorMessage = ref('')
const accessToken = ref('')

async function handleSubmit() {
  status.value = 'pending'
  errorMessage.value = ''
  try {
    const body = new URLSearchParams({ username: email.value, password: password.value })
    const response = await $fetch<AuthTokenResponse>(`${config.public.apiBase}/auth/login`, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })
    accessToken.value = response.access_token
    status.value = 'success'
  } catch (err) {
    status.value = 'error'
    errorMessage.value = extractErrorDetail(err, 'Login failed. Check your email and password.')
  }
}

useSeoMeta({ title: 'Log in — Workboard' })
</script>

<template>
  <div class="shell">
    <h1>Log in</h1>
    <form class="form" novalidate @submit.prevent="handleSubmit">
      <div class="form-field">
        <label for="login-email">Email</label>
        <input
          id="login-email"
          v-model="email"
          type="email"
          required
          autocomplete="email"
        >
      </div>
      <div class="form-field">
        <label for="login-password">Password</label>
        <input
          id="login-password"
          v-model="password"
          type="password"
          required
          autocomplete="current-password"
        >
      </div>
      <button type="submit" class="button button--primary" :disabled="status === 'pending'">
        {{ status === 'pending' ? 'Logging in…' : 'Log in' }}
      </button>
    </form>

    <LoadingIndicator v-if="status === 'pending'" label="Signing you in…" />
    <ErrorAlert v-else-if="status === 'error'" :message="errorMessage" title="Login failed" />
    <p v-else-if="status === 'success'" class="success">
      Logged in against the real backend. Access token received (first 12 characters:
      {{ accessToken.slice(0, 12) }}…). Session persistence isn't wired yet - Module 11
      adds the auth store that keeps you signed in across pages.
    </p>
  </div>
</template>
