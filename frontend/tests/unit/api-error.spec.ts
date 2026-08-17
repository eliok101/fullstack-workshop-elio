import { describe, expect, it } from 'vitest'
import { extractErrorDetail } from '../../app/utils/api-error'

describe('extractErrorDetail', () => {
  it('extracts a string detail from a backend-shaped error', () => {
    const err = { data: { detail: 'Project not found', code: 'not_found' } }
    expect(extractErrorDetail(err, 'fallback')).toBe('Project not found')
  })

  it('returns the fallback when detail is missing', () => {
    const err = { data: {} }
    expect(extractErrorDetail(err, 'fallback message')).toBe('fallback message')
  })

  it('returns the fallback when detail is a FastAPI 422 array, not a string', () => {
    const err = { data: { detail: [{ loc: ['body', 'email'], msg: 'field required' }] } }
    expect(extractErrorDetail(err, 'Check the form for errors.')).toBe('Check the form for errors.')
  })

  it('returns the fallback for a plain network error with no data field', () => {
    const err = new TypeError('Failed to fetch')
    expect(extractErrorDetail(err, 'Network error.')).toBe('Network error.')
  })

  it('returns the fallback for a non-object error value', () => {
    expect(extractErrorDetail('some string', 'fallback')).toBe('fallback')
    expect(extractErrorDetail(null, 'fallback')).toBe('fallback')
    expect(extractErrorDetail(undefined, 'fallback')).toBe('fallback')
  })
})
