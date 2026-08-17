import { describe, expect, it } from 'vitest'
import { renderSuspended } from '@nuxt/test-utils/runtime'
import { screen } from '@testing-library/vue'
import ErrorAlert from '~/components/ErrorAlert.vue'

/**
 * Independent challenge. What this proves: `role="alert"` (ARIA's "alert"
 * role) implicitly carries `aria-live="assertive"` and `aria-atomic="true"`
 * per the ARIA spec - a conforming screen reader announces an element with
 * this role the instant it's added to (or changes within) the accessibility
 * tree, with no separate aria-live wiring required. Querying by
 * `getByRole('alert', { name: ... })` (not a CSS class/selector) proves the
 * accessible name/role contract a real assistive-technology user depends on
 * actually exists in the rendered DOM, not just that some text appears
 * visually. This codebase's error alerts are whole-form errors (login/
 * register failure), not single-field ones - so role="alert" is the right
 * association mechanism here, not `aria-describedby` (which associates a
 * hint/error with one specific input, e.g. register.vue's password hint
 * already does this for non-error help text via
 * aria-describedby="register-password-hint").
 *
 * What this test cannot prove, and still needs a real browser/manual
 * assistive-technology review:
 *   - That an actual screen reader (NVDA/JAWS/VoiceOver) really announces
 *     this element on mount vs. only on a later *change* - some
 *     implementations only announce live-region content that changes after
 *     initial page load, not content present at first paint. Since
 *     ErrorAlert is v-if'd into existence only after a failed submit (not
 *     hidden/shown), it should qualify as "added", but the real
 *     announcement behavior is implementation-specific across AT/browser
 *     combinations and happy-dom does not implement the accessibility tree
 *     or speak anything at all - it only proves the DOM attribute is
 *     present and correctly named.
 *   - Focus movement: after a failed submit, focus stays wherever it was
 *     (the submit button); whether a screen-reader user actually notices
 *     the alert without moving focus there manually (a `tabindex="-1"` +
 *     programmatic `.focus()` pattern some forms use) is a UX judgment this
 *     test doesn't evaluate.
 *   - Timing/interruption behavior - role="alert" is meant to interrupt
 *     whatever the screen reader is currently announcing, which is
 *     genuinely disruptive if triggered too often; only a real AT session
 *     can judge whether that's appropriate here, not a unit test.
 */
describe('ErrorAlert', () => {
  it('exposes the message via an accessible alert role, with the default title', async () => {
    await renderSuspended(ErrorAlert, { props: { message: 'Registration failed. Check the form and try again.' } })

    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Something went wrong')
    expect(alert.textContent).toContain('Registration failed. Check the form and try again.')
  })

  it('exposes a custom title through the same accessible alert region', async () => {
    await renderSuspended(ErrorAlert, {
      props: { message: 'Email already registered.', title: 'Registration failed' }
    })

    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Registration failed')
    expect(alert.textContent).toContain('Email already registered.')
  })
})
