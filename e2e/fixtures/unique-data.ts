/**
 * Deterministic-but-unique identifiers for test data, per
 * docs/testing-strategy.md ("create unique data per test", "keep tests
 * independent"). Timestamp + a short random suffix avoids collisions between
 * parallel workers in the same run without needing a shared counter, and
 * stays human-readable in failure output (unlike a bare UUID).
 */
export function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function uniqueEmail(prefix = 'e2e'): string {
  return `${prefix}-${uniqueSuffix()}@example.com`
}

export function uniqueProjectName(prefix = 'E2E Project'): string {
  return `${prefix} ${uniqueSuffix()}`
}
