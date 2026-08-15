/**
 * Independent challenge: generated on every request (not prerendered/cached),
 * directly from GET /api/v1/projects/public - the backend's live is_public
 * flag is the single source of truth, so there is no separate cleanup job to
 * remove a stale/deleted project: the next time this route runs, a project
 * that has been deleted or flipped to private simply doesn't come back from
 * that query and drops out of the sitemap on its own.
 *
 * Discovery: only the home page and currently-public projects are listed -
 * /login, /register, /dashboard, /projects* are deliberately excluded, since
 * they're either noindex (login/register) or unreachable/unrenderable to an
 * unauthenticated crawler anyway (dashboard/projects, now ssr:false).
 *
 * Scaling limitation, documented rather than silently ignored: this returns
 * every public project in one uncapped query and one XML document. That's
 * fine at this project's current scale (a handful of projects) but does not
 * scale to the real sitemap protocol limit (50,000 URLs / 50MB per file) -
 * the standard fix is a sitemap index file referencing multiple paginated
 * sub-sitemaps, which in turn needs a paginated backend list endpoint
 * (limit/offset or keyset pagination). No project list endpoint in this API
 * has pagination yet (docs/api-contract.md; also flagged in this learner's
 * Module 03 log entry), so implementing fake pagination here against an
 * unpaginated backend endpoint would be misleading rather than useful.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const siteUrl = config.public.siteUrl as string

  const projects = await $fetch<ProjectPublicListItem[]>(
    `${config.apiInternalBase}/projects/public`
  )

  const urls = [
    `<url><loc>${siteUrl}/</loc></url>`,
    ...projects.map(
      (project) =>
        `<url><loc>${siteUrl}/public/projects/${project.slug}</loc><lastmod>${project.updated_at}</lastmod></url>`
    )
  ].join('')

  setResponseHeader(event, 'content-type', 'application/xml')
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`
})
