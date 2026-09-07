export function readPublicSlug(): string | undefined {
  if (typeof window === 'undefined') return undefined
  const path = window.location.pathname || ''
  const pathMatch = path.match(/^\/(?:@|u\/)([a-z0-9][a-z0-9_-]{0,31})\/?$/i)
  if (pathMatch?.[1]) return pathMatch[1].toLowerCase()
  const query = new URLSearchParams(window.location.search).get('u')
  if (query && /^[a-z0-9][a-z0-9_-]{0,31}$/i.test(query)) return query.toLowerCase()
  return undefined
}
