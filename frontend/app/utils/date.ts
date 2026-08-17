/**
 * Real gap found while building Module 13's risk map: nothing in this
 * codebase formats a date anywhere yet (`Task.due_date`/`created_at` and
 * `User.created_at`/`Project.created_at` exist on the wire per
 * #shared/types/api.ts, but no page currently displays any of them - see
 * the Module 13 learning log Step 1 for the honest disclosure). Written
 * here as a standalone, pre-emptively tested pure utility per the module's
 * explicit risk-map item ("date formatting"), not wired into a component
 * since none currently has a real need for it - matching the project's own
 * "don't build ahead of a real requirement" rule (AGENTS.md).
 */
export function formatDate(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Invalid date'
  // timeZone pinned to UTC deliberately: without it, Intl.DateTimeFormat
  // uses the runtime's local timezone, which would render different text
  // for the same value during SSR (Docker, most likely UTC) versus client
  // hydration (the visitor's local timezone) - exactly the hydration
  // mismatch class of bug Module 12 targeted, just not caught until this
  // module actually wrote a test with a date near a UTC day boundary.
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date)
}
