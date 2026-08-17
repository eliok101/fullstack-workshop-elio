import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { fireEvent, screen } from '@testing-library/vue'
import RegisterPage from '~/pages/register.vue'
import type { User } from '#shared/types/api'

/**
 * No dedicated FormXxx.vue component exists yet in this codebase - every
 * form is written directly inside its page (register.vue, login.vue). This
 * is the only genuine "form disabled while saving" behavior available, so
 * it's tested directly as this step's "form/display component", per the
 * module's own risk-map item. useAuthStore is mocked at the composable
 * boundary (not $fetch/the real API client) since Steps 5 and 6 already
 * cover the API client and the store itself - this test is only about
 * register.vue's own rendering/disabled/error-display behavior.
 */
const { mockRegister } = vi.hoisted(() => ({ mockRegister: vi.fn() }))

// auth.global.ts middleware runs on every navigation, including the one
// renderSuspended triggers to mount this page - it calls initAuth() and
// reads isAuthenticated unconditionally, so a mock missing those fields
// makes the middleware throw (a genuine, printed 500) even though it has
// nothing to do with what this test is actually verifying. The full shape
// is provided here for that reason, not because this test cares about it.
mockNuxtImport('useAuthStore', () => {
  return () => ({
    register: mockRegister,
    initAuth: vi.fn().mockResolvedValue(undefined),
    isAuthenticated: false
  })
})

// The success <p> in register.vue contains an inline <NuxtLink>, so its own
// full text ("Account created for X. Log in to continue.") never equals a
// plain string match, and the <a> itself only has "Log in" - a substring
// match against the <p> specifically is the only query that resolves to
// exactly one element.
function successTextContains(email: string) {
  return (_content: string, element: Element | null) =>
    element?.tagName.toLowerCase() === 'p' && !!element.textContent?.includes(`Account created for ${email}`)
}

function fakeUser(email: string): User {
  return { id: 1, email, full_name: 'Test User', is_active: true, created_at: '2026-08-17T00:00:00Z' }
}

async function fillForm() {
  await fireEvent.update(screen.getByLabelText('Full name'), 'Test User')
  await fireEvent.update(screen.getByLabelText('Email'), 'test@example.com')
  await fireEvent.update(screen.getByLabelText('Password'), 'a-real-password')
}

describe('register page form', () => {
  beforeEach(() => {
    mockRegister.mockReset()
  })

  it('disables the submit button and shows saving text while the request is in flight', async () => {
    let resolveRegister!: (user: User) => void
    mockRegister.mockImplementation(() => new Promise<User>((resolve) => { resolveRegister = resolve }))

    await renderSuspended(RegisterPage)
    await fillForm()
    await fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    const pendingButton = screen.getByRole('button', { name: 'Creating account…' }) as HTMLButtonElement
    expect(pendingButton.disabled).toBe(true)

    resolveRegister(fakeUser('test@example.com'))
    await screen.findByText(successTextContains('test@example.com'))
  })

  it('shows the success message with the registered email once the request resolves', async () => {
    mockRegister.mockResolvedValue(fakeUser('new-learner@example.com'))

    await renderSuspended(RegisterPage)
    await fillForm()
    await fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText(successTextContains('new-learner@example.com'))).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Create account' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('shows an accessible error alert with the real message and re-enables the button on failure', async () => {
    mockRegister.mockRejectedValue(new Error('Email already registered.'))

    await renderSuspended(RegisterPage)
    await fillForm()
    await fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Email already registered.')
    expect((screen.getByRole('button', { name: 'Create account' }) as HTMLButtonElement).disabled).toBe(false)
  })
})
