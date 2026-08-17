import { describe, expect, it, vi } from 'vitest'
import { renderSuspended } from '@nuxt/test-utils/runtime'
import { fireEvent, screen } from '@testing-library/vue'
import TaskCard from '~/components/TaskCard.vue'
import type { Task } from '#shared/types/api'

/**
 * Role/name queries (screen.getByRole), not CSS selectors or component
 * internals - per the module's own instruction and docs/testing-strategy.md
 * ("Do not assert private refs, internal method names, or exact
 * implementation markup without a user contract"). Emitted events are
 * asserted via Vue's onXxx-prop convention (onAdvance/onDelete), which is
 * how @testing-library/vue's render result exposes emits - it does not
 * expose a VTU-style wrapper.emitted().
 */
function buildTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 42,
    project_id: 7,
    title: 'Write the risk map',
    description: 'Assign each named behavior to its lowest useful layer.',
    status: 'backlog',
    priority: 'medium',
    assignee_id: null,
    due_date: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...overrides
  }
}

describe('TaskCard', () => {
  it('renders the visible title, status label, and priority label', async () => {
    await renderSuspended(TaskCard, {
      props: { task: buildTask({ title: 'Write the risk map', status: 'in_progress', priority: 'high' }) }
    })
    expect(screen.getByRole('heading', { name: 'Write the risk map' })).toBeTruthy()
    expect(screen.getByText('In progress')).toBeTruthy()
    expect(screen.getByText('Priority: High')).toBeTruthy()
  })

  it('emits advance with the task id when the Advance button is clicked', async () => {
    const onAdvance = vi.fn()
    await renderSuspended(TaskCard, {
      props: { task: buildTask({ id: 99, status: 'backlog' }), onAdvance }
    })
    await fireEvent.click(screen.getByRole('button', { name: 'Advance' }))
    expect(onAdvance).toHaveBeenCalledExactlyOnceWith(99)
  })

  it('emits delete with the task id when the Delete button is clicked', async () => {
    const onDelete = vi.fn()
    await renderSuspended(TaskCard, {
      props: { task: buildTask({ id: 7 }), onDelete }
    })
    await fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onDelete).toHaveBeenCalledExactlyOnceWith(7)
  })

  it('disables the Advance button once a task is done, so an already-final task cannot be advanced again', async () => {
    await renderSuspended(TaskCard, { props: { task: buildTask({ status: 'done' }) } })
    const advanceButton = screen.getByRole('button', { name: 'Advance' }) as HTMLButtonElement
    expect(advanceButton.disabled).toBe(true)
  })

  it.each(['backlog', 'in_progress'] as const)(
    'keeps the Advance button enabled for a %s task, since a real next transition exists',
    async (status) => {
      await renderSuspended(TaskCard, { props: { task: buildTask({ status }) } })
      const advanceButton = screen.getByRole('button', { name: 'Advance' }) as HTMLButtonElement
      expect(advanceButton.disabled).toBe(false)
    }
  )

  it('never disables the Delete button, regardless of status - deletion is always a valid action', async () => {
    await renderSuspended(TaskCard, { props: { task: buildTask({ status: 'done' }) } })
    const deleteButton = screen.getByRole('button', { name: 'Delete' }) as HTMLButtonElement
    expect(deleteButton.disabled).toBe(false)
  })
})
