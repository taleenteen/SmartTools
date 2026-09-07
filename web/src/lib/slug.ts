const ADMIN_SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,31}$/
const USER_SLUG_RE = /^[a-z0-9][a-z0-9_-]{2,31}$/
const ALL_DIGITS_RE = /^[0-9]+$/

const RESERVED_SLUGS = new Set([
  'tools',
  'toolsindex',
  'databak',
  'shared',
  'scripts',
  'config',
  'admin',
  'login',
  'logout',
  'about',
  'index',
  'data',
  'index1',
  'index2',
  'index3',
  'index4',
  'index5',
  'home',
  'help',
  'static',
  'public',
  'assets',
  'api',
  'auth',
  'user',
  'users',
  'archive',
  'archives',
  'save',
  'comment',
  'backup',
  'backups',
  'check',
  'change',
  'migrate',
  'favicon',
  'robots',
  'sitemap',
  'www',
  'mail',
  'ftp',
  'ns',
  'ns1',
  'ns2',
  'cdn',
  'img',
  'images',
  'media',
  'files',
  'download',
  'downloads',
  'settings',
  'setting',
  'preferences',
  'profile',
  'me',
  'signup',
  'signin',
  'register',
  'reset',
  'forgot',
  'password',
  'passwd',
  'security',
  'verify',
  'search',
  'tag',
  'tags',
  'category',
  'categories',
  'feed',
  'rss',
  'atom',
  'blog',
  'post',
  'posts',
  'news',
  'contact',
  'support',
  'feedback',
  'terms',
  'privacy',
  'legal',
  'docs',
  'doc',
  'documentation',
  'wiki',
  'manual',
  'status',
  'health',
  'ping',
  'test',
  'app',
  'apps',
  'web',
  'm',
  'mobile',
  'cgi',
  'bin',
  'null',
  'undefined',
  'true',
  'false',
  'errors',
  'error',
  '404',
  '500',
  'u',
  'at',
  'smarttools',
  'mrr',
])

export type SlugRole = 'admin' | 'user'

export function isValidSlug(value: string, role: SlugRole = 'admin'): boolean {
  if (typeof value !== 'string') return false
  if (ALL_DIGITS_RE.test(value)) return false
  return (role === 'user' ? USER_SLUG_RE : ADMIN_SLUG_RE).test(value)
}

export function isReservedSlug(value: string): boolean {
  return RESERVED_SLUGS.has((value || '').toLowerCase())
}

export function genSlugFromUsername(username: string): string {
  let base = (username || '').toLowerCase().replace(/[^a-z0-9_-]/g, '')
  base = base.replace(/^[^a-z0-9]+/, '')
  return base || 'user'
}

export function slugContainsUsernameSubstring(
  slug: string,
  username: string,
  ratio = 0.7,
): boolean {
  const safeRatio = typeof ratio === 'number' && ratio > 0 && ratio <= 1 ? ratio : 0.7
  if (!slug) return false
  const s = slug.toLowerCase()
  const u = genSlugFromUsername(username || '')
  if (!u) return true
  const required = Math.ceil(u.length * safeRatio)
  if (required <= 0) return true
  if (required > u.length || required > s.length) return false
  let hasNonDigitCandidate = false
  for (let i = 0; i + required <= u.length; i++) {
    const sub = u.substring(i, i + required)
    if (ALL_DIGITS_RE.test(sub)) continue
    hasNonDigitCandidate = true
    if (s.includes(sub)) return true
  }
  return !hasNonDigitCandidate
}

export function requiredUsernameSubstringLen(username: string, ratio = 0.7): number {
  const safeRatio = typeof ratio === 'number' && ratio > 0 && ratio <= 1 ? ratio : 0.7
  const u = genSlugFromUsername(username || '')
  if (!u) return 0
  return Math.ceil(u.length * safeRatio)
}

export type SlugIssue = 'empty' | 'invalid' | 'reserved' | 'substring'

export function slugIssue(
  slug: string,
  role: SlugRole,
  username: string,
): SlugIssue | null {
  const value = slug.trim().toLowerCase()
  if (!value) return 'empty'
  if (!isValidSlug(value, role)) return 'invalid'
  if (isReservedSlug(value)) return 'reserved'
  if (role !== 'admin' && !slugContainsUsernameSubstring(value, username, 0.7)) return 'substring'
  return null
}
