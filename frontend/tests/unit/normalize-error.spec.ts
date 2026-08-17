import { describe, expect, it } from 'vitest'
import { ApiError, normalizeError } from '../../app/utils/api-client'

describe('normalizeError', () => {
  it('uses the backend detail/code when both are present', () => {
    const err = { status: 409, data: { detail: 'Project already exists', code: 'duplicate' } }
    const result = normalizeError(err)
    expect(result).toBeInstanceOf(ApiError)
    expect(result.message).toBe('Project already exists')
    expect(result.status).toBe(409)
    expect(result.code).toBe('duplicate')
  })

  it('uses the backend detail with a null code when code is missing', () => {
    const err = { status: 404, data: { detail: 'Task not found' } }
    const result = normalizeError(err)
    expect(result.message).toBe('Task not found')
    expect(result.status).toBe(404)
    expect(result.code).toBeNull()
  })

  it('produces a fixed validation message for a 422 with no string detail', () => {
    const err = { status: 422, data: { detail: [{ loc: ['body', 'email'], msg: 'field required' }] } }
    const result = normalizeError(err)
    expect(result.message).toBe('Check the form for errors and try again.')
    expect(result.status).toBe(422)
    expect(result.code).toBe('validation_error')
  })

  it('produces a generic message for a non-422 status with no string detail', () => {
    const err = { status: 500, data: {} }
    const result = normalizeError(err)
    expect(result.message).toBe('The request failed. Try again.')
    expect(result.status).toBe(500)
    expect(result.code).toBeNull()
  })

  it('produces a network-error message when there is no status at all (real network failure)', () => {
    const err = { data: undefined }
    const result = normalizeError(err)
    expect(result.message).toBe('Network error - could not reach the server.')
    expect(result.status).toBeNull()
    expect(result.code).toBeNull()
  })

  it.each([
    ['a plain string', 'boom'],
    ['null', null],
    ['undefined', undefined]
  ])('produces a network-error message for a non-object error value (%s)', (_label, err) => {
    const result = normalizeError(err)
    expect(result.message).toBe('Network error - could not reach the server.')
    expect(result.status).toBeNull()
    expect(result.code).toBeNull()
  })
})
