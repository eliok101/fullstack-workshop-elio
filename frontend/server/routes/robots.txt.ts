/**
 * Independent challenge, robots half. Disallow only /dashboard and /projects:
 * both now render no server-side HTML at all (routeRules ssr:false), so
 * there is nothing meaningful for a crawler to fetch there regardless -
 * disallowing saves crawl budget rather than sending it at an empty shell.
 *
 * /login and /register are deliberately NOT disallowed here even though
 * both are noindex (see login.vue/register.vue) - Google's own guidance is
 * that Disallow prevents a crawler from ever fetching the page, which means
 * it never sees the noindex meta tag either; noindex only works on a page a
 * crawler is allowed to fetch. Blocking a page here to keep it out of the
 * index and relying on noindex to keep it out of the index are two
 * different, non-composable mechanisms - this uses the correct one for each
 * page's actual goal (public projects: allow + index; auth forms: allow +
 * noindex; dashboard/projects: disallow, since there's no content to protect
 * or index either way).
 */
export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  const siteUrl = config.public.siteUrl as string

  setResponseHeader(event, 'content-type', 'text/plain')
  return [
    'User-agent: *',
    'Disallow: /dashboard',
    'Disallow: /projects',
    '',
    `Sitemap: ${siteUrl}/sitemap.xml`,
    ''
  ].join('\n')
})
