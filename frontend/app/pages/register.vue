<script setup lang="ts">
const auth = useAuthStore()

const email = ref('')
const fullName = ref('')
const password = ref('')
const status = ref<'idle' | 'pending' | 'success' | 'error'>('idle')
const errorMessage = ref('')
const registeredEmail = ref('')

async function handleSubmit() {
  status.value = 'pending'
  errorMessage.value = ''
  try {
    const user = await auth.register(email.value, fullName.value, password.value)
    registeredEmail.value = user.email
    status.value = 'success'
  } catch (err) {
    status.value = 'error'
    errorMessage.value = err instanceof Error ? err.message : 'Registration failed. Check the form and try again.'
  }
}

// Step 3/Step 1 table: same reasoning as login.vue - a guest-only auth form,
// noindex rather than indexable.
useSeoMeta({ title: 'Create an account — Workboard', robots: 'noindex, nofollow' })
</script>

<template>
  <div class="shell">
    <h1>Create an account</h1>
    <form class="form" novalidate @submit.prevent="handleSubmit">
      <div class="form-field">
        <label for="register-name">Full name</label>
        <input
          id="register-name"
          v-model="fullName"
          type="text"
          required
          autocomplete="name"
        >
      </div>
      <div class="form-field">
        <label for="register-email">Email</label>
        <input
          id="register-email"
          v-model="email"
          type="email"
          required
          autocomplete="email"
        >
      </div>
      <div class="form-field">
        <label for="register-password">Password</label>
        <input
          id="register-password"
          v-model="password"
          type="password"
          required
          minlength="8"
          autocomplete="new-password"
          aria-describedby="register-password-hint"
        >
        <p id="register-password-hint" class="form-hint">At least 8 characters.</p>
      </div>
      <button type="submit" class="button button--primary" :disabled="status === 'pending'">
        {{ status === 'pending' ? 'Creating account…' : 'Create account' }}
      </button>
    </form>

    <LoadingIndicator v-if="status === 'pending'" label="Creating your account…" />
    <ErrorAlert v-else-if="status === 'error'" :message="errorMessage" title="Registration failed" />
    <p v-else-if="status === 'success'" class="success">
      Account created for {{ registeredEmail }}.
      <NuxtLink to="/login">Log in</NuxtLink> to continue.
    </p>
  </div>
</template>
