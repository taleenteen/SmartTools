export function openHref(url: string | undefined, isLocal?: boolean): string | undefined {
  if (!url) return undefined
  if (isLocal) return url.startsWith('/') ? url : `/${url}`
  return url
}
