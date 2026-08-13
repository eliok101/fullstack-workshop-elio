<script setup lang="ts">
const auth = useAuthStore()
const route = useRoute()

const email = ref('')
const password = ref('')
const status = ref<'idle' | 'pending' | 'success' | 'error'>('idle')
const errorMessage = ref('')

async function handleSubmit() {
  status.value = 'pending'
  errorMessage.value = ''
  try {
    await auth.login(email.value, password.value)
    status.value = 'success'
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard'
    await navigateTo(redirect)
  } catch (err) {
    status.value = 'error'
    errorMessage.value = err instanceof Error ? err.message : 'Login failed. Check your email and password.'
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
    <p v-else-if="status === 'success'" class="success">Logged in - redirecting…</p>
  </div>
</template>
