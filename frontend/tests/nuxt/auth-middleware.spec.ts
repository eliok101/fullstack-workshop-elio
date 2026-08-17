import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import type { RouteLocationNormalized } from 'vue-router'

/**
 * Step 6: "auth middleware redirect" - picked over the alternative example
 * (logout clearing state after a network failure) because it's the one
 * behavior on the Step 1 risk map that genuinely needs Nuxt route context
 * (useAuthStore + navigateTo), which is exactly what this step calls for.
 *
 * defineNuxtRouteMiddleware(fn) just returns fn unchanged (Nuxt only uses
 * the wrapper for file-based registration/typing) - importing the default
 * export and calling it directly with fake `to`/`from` route objects is a
 * real, direct test of the actual logic, not a reimplementation of it.
 *
 * Real environment limitation, documented rather than hidden: the
 * `if (import.meta.server) return` guard at the top of the middleware is
 * not exercised here. `import.meta.server` is a Vite-time constant baked in
 * at build time for the 'nuxt' Vitest environment's client-mode build, not
 * a runtime value this test can flip per-case - so the server-skip branch
 * has no automated coverage. It is trivial (a bare early return before any
 * other statement) and was already re-verified live via curl in Module 11
 * for the equivalent client-only routes; that manual verification, not a
 * test, is what backs this branch today.
 */
const { mockInitAuth, mockNavigateTo } = vi.hoisted(() => ({
  mockInitAuth: vi.fn(),
  mockNavigateTo: vi.fn()
}))

let isAuthenticated = false

mockNuxtImport('useAuthStore', () => {
  return () => ({
    initAuth: mockInitAuth,
    get isAuthenticated() {
      return isAuthenticated
    }
  })
})

mockNuxtImport('navigateTo', () => mockNavigateTo)

function route(path: string): RouteLocationNormalized {
  return { path, fullPath: path } as RouteLocationNormalized
}

describe('auth.global middleware', () => {
  beforeEach(async () => {
    mockInitAuth.mockReset().mockResolvedValue(undefined)
    mockNavigateTo.mockReset().mockReturnValue('navigate-to-sentinel')
    isAuthenticated = false
  })

  it('redirects an unauthenticated visitor away from a protected route, preserving it as the redirect target', async () => {
    const middleware = (await import('~/middleware/auth.global')).default
    isAuthenticated = false

    const result = await middleware(route('/dashboard'), route('/'))

    expect(mockInitAuth).toHaveBeenCalledOnce()
    expect(mockNavigateTo).toHaveBeenCalledExactlyOnceWith({ path: '/login', query: { redirect: '/dashboard' } })
    expect(result).toBe('navigate-to-sentinel')
  })

  it('redirects an unauthenticated visitor away from a nested protected route (/projects/5)', async () => {
    const middleware = (await import('~/middleware/auth.global')).default
    isAuthenticated = false

    await middleware(route('/projects/5'), route('/'))

    expect(mockNavigateTo).toHaveBeenCalledExactlyOnceWith({ path: '/login', query: { redirect: '/projects/5' } })
  })

  it('does not redirect an authenticated visitor on a protected route', async () => {
    const middleware = (await import('~/middleware/auth.global')).default
    isAuthenticated = true

    const result = await middleware(route('/dashboard'), route('/'))

    expect(mockNavigateTo).not.toHaveBeenCalled()
    expect(result).toBeUndefined()
  })

  it('sends an already-authenticated visitor away from /login to /dashboard', async () => {
    const middleware = (await import('~/middleware/auth.global')).default
    isAuthenticated = true

    await middleware(route('/login'), route('/'))

    expect(mockNavigateTo).toHaveBeenCalledExactlyOnceWith('/dashboard')
  })

  it('leaves an unauthenticated guest on /login alone', async () => {
    const middleware = (await import('~/middleware/auth.global')).default
    isAuthenticated = false

    const result = await middleware(route('/login'), route('/'))

    expect(mockNavigateTo).not.toHaveBeenCalled()
    expect(result).toBeUndefined()
  })

  it('always awaits initAuth() before making any redirect decision', async () => {
    const middleware = (await import('~/middleware/auth.global')).default
    const order: string[] = []
    mockInitAuth.mockImplementation(async () => {
      order.push('initAuth')
      isAuthenticated = true
    })
    mockNavigateTo.mockImplementation(() => {
      order.push('navigateTo')
      return 'navigate-to-sentinel'
    })

    await middleware(route('/login'), route('/'))

    expect(order).toEqual(['initAuth', 'navigateTo'])
  })
})
