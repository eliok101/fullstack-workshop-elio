/**
 * Narrows an unknown catch-block value (or a useFetch/useAsyncData error) to
 * the human-readable `detail` the backend sends on domain failures (see
 * docs/api-contract.md's error body shape), falling back to a generic
 * message when the shape doesn't match - e.g. a network failure with no
 * response body, or FastAPI's structured 422 (whose `detail` is an array,
 * not a string, and isn't meant to be shown verbatim to an end user).
 */
export function extractErrorDetail(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'data' in err) {
    const data = (err as { data?: unknown }).data
    if (data && typeof data === 'object' && 'detail' in data) {
      const detail = (data as { detail?: unknown }).detail
      if (typeof detail === 'string') return detail
    }
  }
  return fallback
}
