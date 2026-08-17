import { describe, expect, it } from 'vitest'
import { priorityLabel, statusLabel } from '../../app/utils/labels'
import type { TaskPriority, TaskStatus } from '../../shared/types/api'

describe('statusLabel', () => {
  it.each<[TaskStatus, string]>([
    ['backlog', 'Backlog'],
    ['in_progress', 'In progress'],
    ['done', 'Done']
  ])('maps %s to exactly %s', (status, expected) => {
    expect(statusLabel(status)).toBe(expected)
  })
})

describe('priorityLabel', () => {
  it.each<[TaskPriority, string]>([
    ['low', 'Low'],
    ['medium', 'Medium'],
    ['high', 'High']
  ])('maps %s to exactly %s', (priority, expected) => {
    expect(priorityLabel(priority)).toBe(expected)
  })
})
