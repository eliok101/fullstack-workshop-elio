/**
 * One place for every project/task request shape, built on top of the
 * shared $api client (base URL, bearer, refresh - see
 * app/utils/api-client.ts). Pages call these functions instead of building
 * requests themselves, so refresh/retry logic is never duplicated per page
 * as the module explicitly warns against.
 */
import type {
  Project,
  ProjectCreateRequest,
  Task,
  TaskCreateRequest,
  TaskUpdateRequest
} from '#shared/types/api'

export function useProjectsApi() {
  const { $api } = useNuxtApp()

  return {
    listProjects: (signal?: AbortSignal) => $api.get<Project[]>('/projects', { signal }),
    getProject: (id: number, signal?: AbortSignal) => $api.get<Project>(`/projects/${id}`, { signal }),
    createProject: (payload: ProjectCreateRequest) => $api.post<Project>('/projects', { body: payload }),

    listTasks: (projectId: number, signal?: AbortSignal) =>
      $api.get<Task[]>(`/projects/${projectId}/tasks`, { signal }),
    createTask: (projectId: number, payload: TaskCreateRequest) =>
      $api.post<Task>(`/projects/${projectId}/tasks`, { body: payload }),
    updateTask: (projectId: number, taskId: number, payload: TaskUpdateRequest) =>
      $api.patch<Task>(`/projects/${projectId}/tasks/${taskId}`, { body: payload }),
    deleteTask: (projectId: number, taskId: number) =>
      $api.delete(`/projects/${projectId}/tasks/${taskId}`)
  }
}
