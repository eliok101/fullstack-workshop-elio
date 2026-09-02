import { describe, expect, it, vi } from 'vitest'
import { renderSuspended } from '@nuxt/test-utils/runtime'
import { fireEvent, screen } from '@testing-library/vue'
import PaginationControls from '~/components/PaginationControls.vue'

/**
 * Real, live coverage for a component that had none: this had sat unused
 * since it was built (docs/api-contract.md's project list had no page/limit
 * params yet), so its own boundary logic - the part most worth getting
 * right before wiring it to a real list - was never actually exercised by
 * a test. Now used by app/pages/projects/index.vue.
 */
describe('PaginationControls', () => {
  it('announces the current position', async () => {
    await renderSuspended(PaginationControls, { props: { currentPage: 2, totalPages: 5 } })
    expect(screen.getByText('Page 2 of 5')).toBeTruthy()
  })

  it('emits update:currentPage one page forward when Next is clicked', async () => {
    const onUpdateCurrentPage = vi.fn()
    await renderSuspended(PaginationControls, {
      props: { currentPage: 2, totalPages: 5, 'onUpdate:currentPage': onUpdateCurrentPage }
    })
    await fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(onUpdateCurrentPage).toHaveBeenCalledExactlyOnceWith(3)
  })

  it('emits update:currentPage one page back when Previous is clicked', async () => {
    const onUpdateCurrentPage = vi.fn()
    await renderSuspended(PaginationControls, {
      props: { currentPage: 2, totalPages: 5, 'onUpdate:currentPage': onUpdateCurrentPage }
    })
    await fireEvent.click(screen.getByRole('button', { name: 'Previous' }))
    expect(onUpdateCurrentPage).toHaveBeenCalledExactlyOnceWith(1)
  })

  it('disables Previous on the first page, so it cannot go below page 1', async () => {
    const onUpdateCurrentPage = vi.fn()
    await renderSuspended(PaginationControls, {
      props: { currentPage: 1, totalPages: 5, 'onUpdate:currentPage': onUpdateCurrentPage }
    })
    const previousButton = screen.getByRole('button', { name: 'Previous' }) as HTMLButtonElement
    expect(previousButton.disabled).toBe(true)
    await fireEvent.click(previousButton)
    expect(onUpdateCurrentPage).not.toHaveBeenCalled()
  })

  it('disables Next on the last page, so it cannot go past total-pages', async () => {
    const onUpdateCurrentPage = vi.fn()
    await renderSuspended(PaginationControls, {
      props: { currentPage: 5, totalPages: 5, 'onUpdate:currentPage': onUpdateCurrentPage }
    })
    const nextButton = screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement
    expect(nextButton.disabled).toBe(true)
    await fireEvent.click(nextButton)
    expect(onUpdateCurrentPage).not.toHaveBeenCalled()
  })

  it('disables both controls when there is only a single page', async () => {
    await renderSuspended(PaginationControls, { props: { currentPage: 1, totalPages: 1 } })
    expect((screen.getByRole('button', { name: 'Previous' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
