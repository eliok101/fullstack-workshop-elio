/**
 * Single transport layer for every backend call. Centralizing this - instead
 * of letting each page call $fetch directly, the way login.vue/register.vue
 * did in Module 10 - is what makes base-URL selection, bearer attachment,
 * the one-time refresh-and-retry on an expired access token, and error
 * normalization a single, testable piece of behavior instead of logic
 * copy-pasted (and inevitably drifting) across every page.
 *
 * Built as a plain factory function (createApiClient), not a Nuxt composable
 * directly, per the module's own instruction: "receives a fetcher and
 * callbacks for access token, refresh, and authentication failure" so it can
 * be unit-tested with a fake fetcher/store, with no Nuxt app context needed.
 */

export interface ApiRequestInit {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  // Deliberately loose: callers pass a typed request body (e.g.
  // ProjectCreateRequest) or a URLSearchParams (login's form encoding), and
  // $fetch itself decides JSON- vs pass-through encoding based on the
  // runtime value - a narrower static type here couldn't express both.
  body?: unknown
  query?: Record<string, unknown>
  headers?: Record<string, string>
  signal?: AbortSignal
}

/**
 * Normalized shape every caller can rely on, regardless of whether the
 * failure was a backend domain error (has status/code/detail), a FastAPI
 * 422 validation error (detail is an array, not a string), or a genuine
 * network failure (no response at all - status/code are null).
 */
export class ApiError extends Error {
  readonly status: number | null
  readonly code: string | null

  constructor(message: string, status: number | null, code: string | null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

interface FetchErrorLike {
  status?: number
  data?: { detail?: unknown; code?: unknown }
}

function normalizeError(err: unknown): ApiError {
  if (err && typeof err === 'object') {
    const fetchErr = err as FetchErrorLike
    const status = typeof fetchErr.status === 'number' ? fetchErr.status : null
    const detail = fetchErr.data?.detail
    if (typeof detail === 'string') {
      const code = typeof fetchErr.data?.code === 'string' ? fetchErr.data.code : null
      return new ApiError(detail, status, code)
    }
    if (status === 422) {
      return new ApiError('Check the form for errors and try again.', status, 'validation_error')
    }
    if (status !== null) {
      return new ApiError('The request failed. Try again.', status, null)
    }
  }
  return new ApiError('Network error - could not reach the server.', null, null)
}

export interface ApiClientOptions {
  /** Resolved per-request so SSR (Docker DNS) and browser (public host) never share a stale base. */
  baseURL: () => string
  getAccessToken: () => string | null
  /** Performs the actual POST /auth/refresh call; returns the new access token or null on failure. */
  refresh: () => Promise<string | null>
  /** Called once a refreshed token still gets a 401 - i.e. the session is genuinely gone. */
  onAuthFailure: () => void | Promise<void>
}

export interface ApiClient {
  get: <T>(path: string, init?: ApiRequestInit) => Promise<T>
  post: <T>(path: string, init?: ApiRequestInit) => Promise<T>
  patch: <T>(path: string, init?: ApiRequestInit) => Promise<T>
  delete: <T = void>(path: string, init?: ApiRequestInit) => Promise<T>
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  // Shared across calls that 401 concurrently so two in-flight requests
  // trigger exactly one refresh, not one each.
  let refreshPromise: Promise<string | null> | null = null

  function runRefresh(): Promise<string | null> {
    if (!refreshPromise) {
      refreshPromise = options.refresh().finally(() => {
        refreshPromise = null
      })
    }
    return refreshPromise
  }

  async function request<T>(path: string, init: ApiRequestInit, isRetry: boolean): Promise<T> {
    const token = options.getAccessToken()
    try {
      // Not passed as $fetch<T>(...): ofetch's generic overload ties its
      // response type to the literal request path (NitroFetchRequest) in a
      // way that conflicts with an arbitrary caller-supplied T here. The
      // cast below is the one place that promise lives - see the
      // compile-time-only-contract warning in shared/types/api.ts.
      const response = await $fetch(path, {
        baseURL: options.baseURL(),
        method: init.method ?? 'GET',
        body: init.body as never,
        query: init.query,
        signal: init.signal,
        // Cross-origin (localhost:3000 -> localhost:8000) requests do not
        // send cookies by default; the refresh cookie needs this explicitly,
        // and the backend's CORS config (allow_credentials + an explicit
        // origin, never "*") exists specifically to allow it.
        credentials: 'include',
        headers: {
          ...init.headers,
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      })
      return response as T
    } catch (err) {
      const status = (err as FetchErrorLike | null)?.status
      // Only ever retry once: a request that still 401s after a fresh token
      // is a real auth failure, not a token that needs refreshing again -
      // retrying it forever is the module's own named failure mode.
      if (status === 401 && !isRetry) {
        const newToken = await runRefresh()
        if (newToken) {
          return request<T>(path, init, true)
        }
        await options.onAuthFailure()
      }
      throw normalizeError(err)
    }
  }

  return {
    get: (path, init = {}) => request(path, { ...init, method: 'GET' }, false),
    post: (path, init = {}) => request(path, { ...init, method: 'POST' }, false),
    patch: (path, init = {}) => request(path, { ...init, method: 'PATCH' }, false),
    delete: (path, init = {}) => request(path, { ...init, method: 'DELETE' }, false)
  }
}
