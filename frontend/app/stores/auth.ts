/**
 * Shared authentication state - current user, in-memory access token, and an
 * explicit initializing/authenticated/unauthenticated status. Pinia, not
 * Nuxt's built-in useState: this project's own docs/architecture.md draws
 * `Page --> Store[Pinia auth store]` and AGENTS.md names Pinia for "shared
 * authenticated state... when necessary" - auth is exactly that (read by the
 * header, the route middleware, and every protected page), unlike
 * project/task data, which stays page-local per that same rule.
 *
 * The access token deliberately lives only in this in-memory ref, never in
 * localStorage/sessionStorage/a cookie the frontend controls - see
 * docs/security.md ("frontend stores the access token in memory, reducing
 * persistent browser exposure") and the module's own explicit instruction.
 * A hard page reload always starts from token = null and must re-derive
 * auth state via initAuth()'s silent refresh against the real httpOnly
 * refresh cookie - that round trip is the cost of not persisting it, and is
 * an accepted, documented tradeoff, not an oversight.
 */
import { defineStore } from 'pinia'
import type { AuthTokenResponse, User } from '#shared/types/api'

type AuthStatus = 'initializing' | 'authenticated' | 'unauthenticated'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const accessToken = ref<string | null>(null)
  const status = ref<AuthStatus>('initializing')

  const isAuthenticated = computed(() => status.value === 'authenticated')
  const isInitializing = computed(() => status.value === 'initializing')

  // Guards initAuth() so the client plugin's call and the route middleware's
  // own call (belt-and-braces against their relative timing - see
  // middleware/auth.global.ts) share one in-flight attempt instead of firing
  // the refresh request twice.
  let initPromise: Promise<void> | null = null

  function baseURL(): string {
    const config = useRuntimeConfig()
    return import.meta.server ? config.apiInternalBase : config.public.apiBase
  }

  function clearSession() {
    user.value = null
    accessToken.value = null
    status.value = 'unauthenticated'
  }

  /**
   * Raw fetch, deliberately outside the $api client: refreshing the token
   * *is* the recovery path the client's own 401-retry calls into, so
   * routing it back through that client would risk a refresh calling itself.
   */
  async function rawRefresh(): Promise<string | null> {
    try {
      const response = await $fetch<AuthTokenResponse>('/auth/refresh', {
        baseURL: baseURL(),
        method: 'POST',
        credentials: 'include'
      })
      accessToken.value = response.access_token
      return response.access_token
    } catch {
      return null
    }
  }

  async function loadMe(): Promise<void> {
    const { $api } = useNuxtApp()
    user.value = await $api.get<User>('/auth/me')
  }

  /** Attempts a silent refresh using the Module 08 httpOnly cookie, then loads the user if it succeeds. Safe to call more than once - later callers just await the same attempt. */
  function initAuth(): Promise<void> {
    if (initPromise) return initPromise
    initPromise = (async () => {
      const token = await rawRefresh()
      if (!token) {
        status.value = 'unauthenticated'
        return
      }
      try {
        await loadMe()
        status.value = 'authenticated'
      } catch {
        // Token refreshed but /auth/me still failed (e.g. user deactivated
        // between token issuance and this call) - treat as logged out
        // rather than pretending to have a user we couldn't actually load.
        clearSession()
      }
    })()
    return initPromise
  }

  async function login(email: string, password: string): Promise<void> {
    const { $api } = useNuxtApp()
    const body = new URLSearchParams({ username: email, password })
    const response = await $api.post<AuthTokenResponse>('/auth/login', {
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })
    accessToken.value = response.access_token
    await loadMe()
    status.value = 'authenticated'
  }

  async function register(email: string, fullName: string, password: string): Promise<User> {
    const { $api } = useNuxtApp()
    return $api.post<User>('/auth/register', {
      body: { email, full_name: fullName, password }
    })
  }

  async function logout(): Promise<void> {
    try {
      await $fetch('/auth/logout', { baseURL: baseURL(), method: 'POST', credentials: 'include' })
    } catch (err) {
      // Per the module's own instruction: clear local state regardless, but
      // don't silently swallow the failure - it's real, useful information
      // (e.g. backend unreachable) even though it doesn't block sign-out.
      console.warn('Logout request failed; clearing local session anyway.', err)
    } finally {
      clearSession()
    }
  }

  return {
    user,
    accessToken,
    status,
    isAuthenticated,
    isInitializing,
    initAuth,
    login,
    register,
    logout,
    clearSession,
    refresh: rawRefresh
  }
})
