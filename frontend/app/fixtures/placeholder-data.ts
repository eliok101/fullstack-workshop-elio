/**
 * Placeholder data for authenticated pages that don't have a real API
 * client/session to call yet (that's Module 11's job - see
 * workshop/11-frontend-api-integration-and-state.md). Kept in one small,
 * clearly-named file specifically so it's easy to find and delete once the
 * real fetch layer exists. Nothing here should be mistaken for persisted
 * backend state.
 */
import type { Project, Task } from '#shared/types/api'

export const placeholderProjects: Project[] = [
  {
    id: 1,
    name: 'Workboard Capstone',
    slug: 'workboard-capstone',
    description: 'The capstone project this workshop builds toward.',
    is_public: true,
    owner_id: 1,
    created_at: '2026-07-01T09:00:00Z',
    updated_at: '2026-08-01T09:00:00Z'
  },
  {
    id: 2,
    name: 'Personal Notes',
    slug: 'personal-notes',
    description: null,
    is_public: false,
    owner_id: 1,
    created_at: '2026-07-15T09:00:00Z',
    updated_at: '2026-07-15T09:00:00Z'
  }
]

export const placeholderTasksByProjectId: Record<number, Task[]> = {
  1: [
    {
      id: 101,
      project_id: 1,
      title: 'Wire the real API client',
      description: "Module 11 replaces this page's placeholder data with real requests.",
      status: 'in_progress',
      priority: 'high',
      assignee_id: null,
      due_date: null,
      created_at: '2026-08-01T09:00:00Z',
      updated_at: '2026-08-05T09:00:00Z'
    },
    {
      id: 102,
      project_id: 1,
      title: 'Add task filtering UI',
      description: null,
      status: 'backlog',
      priority: 'medium',
      assignee_id: null,
      due_date: null,
      created_at: '2026-08-01T09:00:00Z',
      updated_at: '2026-08-01T09:00:00Z'
    },
    {
      id: 103,
      project_id: 1,
      title: 'Draft the accessibility checklist',
      description: null,
      status: 'done',
      priority: 'low',
      assignee_id: null,
      due_date: null,
      created_at: '2026-07-20T09:00:00Z',
      updated_at: '2026-07-25T09:00:00Z'
    }
  ],
  // Deliberately empty: gives the task list a real, honest way to exercise
  // its empty state instead of only ever rendering a populated grid.
  2: []
}
