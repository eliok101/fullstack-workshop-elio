import { describe, expect, it } from 'vitest'
import { formatDate } from '../../app/utils/date'

describe('formatDate', () => {
  it.each([
    [null, '—'],
    [undefined, '—'],
    ['', '—']
  ])('returns the em dash placeholder for %s', (input, expected) => {
    expect(formatDate(input as string | null | undefined)).toBe(expected)
  })

  it.each([
    ['not-a-date'],
    ['2026-13-45'],
    ['definitely not parseable']
  ])('returns "Invalid date" for the unparseable value %s', (input) => {
    expect(formatDate(input)).toBe('Invalid date')
  })

  it('formats a valid ISO date string as a short human-readable date', () => {
    expect(formatDate('2026-08-17T10:00:00Z')).toBe('Aug 17, 2026')
  })

  it('formats a valid date-only ISO string', () => {
    expect(formatDate('2026-01-05')).toBe('Jan 5, 2026')
  })
})
