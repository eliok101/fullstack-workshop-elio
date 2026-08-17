/**
 * Human-readable labels for the domain enums (see #shared/types/api.ts).
 * Extracted as standalone pure functions - rather than left as the
 * private, unexported `labels` record that used to live only inside
 * StatusBadge.vue's <script setup> - specifically so the mapping itself is
 * directly unit-testable without mounting a component (Module 13's own
 * "lowest useful layer" principle). StatusBadge.vue now imports and uses
 * statusLabel instead of duplicating the record.
 */
import type { TaskPriority, TaskStatus } from '#shared/types/api'

const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  in_progress: 'In progress',
  done: 'Done'
}

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High'
}

export function statusLabel(status: TaskStatus): string {
  return STATUS_LABELS[status]
}

export function priorityLabel(priority: TaskPriority): string {
  return PRIORITY_LABELS[priority]
}
