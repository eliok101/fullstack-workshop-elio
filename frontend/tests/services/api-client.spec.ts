import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createApiClient, type ApiClientOptions } from '../../app/utils/api-client'

/**
 * The real request function (createApiClient's internal `request`) is never
 * mocked - only its two real boundaries are: the fetcher (a fake standing in
 * for the network) and the token/refresh/auth-failure callbacks (a fake
 * standing in for the auth store). This is what actually exercises the
 * client's own refresh/retry/error-normalization logic instead of assuming
 * it.
 */
function buildOptions(overrides: Partial<ApiClientOptions> = {}) {
  return {
    baseURL: () => 'http://api.test/api/v1',
    getAccessToken: () => 'initial-token',
    refresh: vi.fn(),
    onAuthFailure: vi.fn(),
    fetcher: vi.fn(),
    ...overrides
  } satisfies ApiClientOptions
}

function unauthorizedError(): { status: number; data: { detail: string; code: string } } {
  return { status: 401, data: { detail: 'Could not validate credentials', code: 'invalid_token' } }
}

describe('createApiClient', () => {
  let fetcher: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetcher = vi.fn()
  })

  it('resolves the base URL per request and attaches the bearer token when one exists', async () => {
    fetcher.mockResolvedValue({ ok: true })
    const client = createApiClient(buildOptions({ fetcher, getAccessToken: () => 'abc123' }))

    await client.get('/projects')

    expect(fetcher).toHaveBeenCalledExactlyOnceWith('/projects', expect.objectContaining({
      baseURL: 'http://api.test/api/v1',
      headers: expect.objectContaining({ Authorization: 'Bearer abc123' })
    }))
  })

  it('omits the Authorization header entirely when there is no access token', async () => {
    fetcher.mockResolvedValue({ ok: true })
    const client = createApiClient(buildOptions({ fetcher, getAccessToken: () => null }))

    await client.get('/public/projects/demo')

    const call = fetcher.mock.calls[0][1] as { headers: Record<string, string> }
    expect(call.headers).not.toHaveProperty('Authorization')
  })

  it('forwards method and body exactly as given', async () => {
    fetcher.mockResolvedValue({ id: 1 })
    const client = createApiClient(buildOptions({ fetcher }))

    await client.post('/projects', { body: { name: 'Workboard', is_public: true } })

    expect(fetcher).toHaveBeenCalledExactlyOnceWith('/projects', expect.objectContaining({
      method: 'POST',
      body: { name: 'Workboard', is_public: true }
    }))
  })

  it('defaults to GET when no method is forced by the client method used', async () => {
    fetcher.mockResolvedValue([])
    const client = createApiClient(buildOptions({ fetcher }))

    await client.get('/projects')

    expect(fetcher).toHaveBeenCalledExactlyOnceWith('/projects', expect.objectContaining({ method: 'GET' }))
  })

  it('returns the fetcher result unchanged on a normal success', async () => {
    const project = { id: 1, name: 'Workboard' }
    fetcher.mockResolvedValue(project)
    const client = createApiClient(buildOptions({ fetcher }))

    await expect(client.get('/projects/1')).resolves.toEqual(project)
  })

  it('on a first 401, refreshes exactly once and retries the same request with the new token', async () => {
    // getAccessToken must be stateful, not a constant: the real plugin
    // wires it to the auth store's accessToken ref, which refresh()'s own
    // real implementation (rawRefresh) mutates as a side effect - a fake
    // that returns a fixed value regardless of refresh() having run doesn't
    // model that contract, and the first version of this test (returning a
    // constant 'stale-token') passed for the wrong reason until this
    // assertion on the retry's actual header caught it.
    let currentToken = 'stale-token'
    const refresh = vi.fn(async () => {
      currentToken = 'fresh-token'
      return currentToken
    })
    fetcher
      .mockRejectedValueOnce(unauthorizedError())
      .mockResolvedValueOnce({ id: 1, name: 'Workboard' })
    const client = createApiClient(buildOptions({ fetcher, refresh, getAccessToken: () => currentToken }))

    const result = await client.get('/projects/1')

    expect(result).toEqual({ id: 1, name: 'Workboard' })
    expect(refresh).toHaveBeenCalledOnce()
    expect(fetcher).toHaveBeenCalledTimes(2)
    const retryCall = fetcher.mock.calls[1][1] as { headers: Record<string, string> }
    expect(retryCall.headers.Authorization).toBe('Bearer fresh-token')
  })

  it('calls onAuthFailure and rejects with the original 401 when refresh fails', async () => {
    const refresh = vi.fn().mockResolvedValue(null)
    const onAuthFailure = vi.fn()
    fetcher.mockRejectedValue(unauthorizedError())
    const client = createApiClient(buildOptions({ fetcher, refresh, onAuthFailure }))

    await expect(client.get('/projects/1')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Could not validate credentials',
      status: 401
    })
    expect(onAuthFailure).toHaveBeenCalledOnce()
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it('does not recurse on a second 401 after an already-refreshed retry - refresh runs exactly once', async () => {
    const refresh = vi.fn().mockResolvedValue('fresh-token')
    const onAuthFailure = vi.fn()
    // Deliberately bounded (5 rejections, not infinite): this mutation
    // drill's own Step 7 found that a fetcher which rejects 401 forever is
    // unsafe to run against a mutant that removes the retry cap - it
    // doesn't fail, it OOM-crashes the test runner in a few seconds,
    // because nothing ever stops the recursion. A bounded mock still fully
    // proves the real client's cap (it only ever reaches 2 calls before
    // throwing) while staying safe to run against any mutant.
    for (let i = 0; i < 5; i++) fetcher.mockRejectedValueOnce(unauthorizedError())
    fetcher.mockResolvedValue({ ok: true })
    const client = createApiClient(buildOptions({ fetcher, refresh, onAuthFailure }))

    await expect(client.get('/projects/1')).rejects.toMatchObject({ status: 401 })

    expect(refresh).toHaveBeenCalledOnce()
    expect(fetcher).toHaveBeenCalledTimes(2)
    // The module's own named failure mode: retrying forever. onAuthFailure
    // is NOT called here because the retry's 401 falls straight through to
    // normalizeError (isRetry is true) - it never re-enters the refresh
    // branch that calls onAuthFailure at all. Confirms the recursion the
    // module warns about genuinely cannot happen, not just that it stops
    // eventually.
    expect(onAuthFailure).not.toHaveBeenCalled()
  })

  it('normalizes a non-401 error without ever touching refresh', async () => {
    const refresh = vi.fn()
    fetcher.mockRejectedValue({ status: 409, data: { detail: 'Project already exists', code: 'duplicate' } })
    const client = createApiClient(buildOptions({ fetcher, refresh }))

    await expect(client.post('/projects', { body: {} })).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Project already exists',
      status: 409,
      code: 'duplicate'
    })
    expect(refresh).not.toHaveBeenCalled()
  })

  it('bonus (beyond the module list): two concurrent 401s share exactly one in-flight refresh, per the client\'s own documented design', async () => {
    let resolveRefresh!: (token: string) => void
    const refresh = vi.fn(() => new Promise<string>((resolve) => { resolveRefresh = resolve }))
    fetcher
      .mockRejectedValueOnce(unauthorizedError())
      .mockRejectedValueOnce(unauthorizedError())
      .mockResolvedValueOnce({ ok: 1 })
      .mockResolvedValueOnce({ ok: 2 })
    const client = createApiClient(buildOptions({ fetcher, refresh }))

    const first = client.get('/a')
    const second = client.get('/b')
    // refresh() is only invoked after each fetcher rejection propagates
    // through a real microtask chain (await fetcher -> catch -> runRefresh
    // -> options.refresh) - resolving synchronously right after issuing
    // both requests raced ahead of that and threw (resolveRefresh unset).
    // waitFor polls until the real chain has actually reached refresh().
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce())
    resolveRefresh('fresh-token')

    await expect(first).resolves.toEqual({ ok: 1 })
    await expect(second).resolves.toEqual({ ok: 2 })
    expect(refresh).toHaveBeenCalledOnce()
  })
})
