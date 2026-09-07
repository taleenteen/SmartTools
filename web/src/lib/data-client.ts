import { parseDataJs, type ParsedBookmarkData } from '@/lib/parse-data-js'
import type { ViewerInfo } from '@/types/bookmark'

export interface LoadedBookmarkPayload extends ParsedBookmarkData {
  source: 'api' | 'static' | 'folder'
  viewer: ViewerInfo
}

function extractViewer(text: string): ViewerInfo {
  const match = text.match(/window\.__viewerInfo\s*=\s*(\{[\s\S]*?\});/)
  if (!match?.[1]) {
    return { isAdminView: true }
  }
  try {
    const parsed = JSON.parse(match[1]) as Partial<ViewerInfo>
    return {
      isAdminView: parsed.isAdminView !== false && !parsed.slug,
      slug: parsed.slug,
      username: parsed.username,
      role: parsed.role,
    }
  } catch {
    return { isAdminView: true }
  }
}

async function readText(url: string): Promise<string> {
  const response = await fetch(url, { credentials: 'same-origin' })
  if (!response.ok) {
    throw new Error(`Failed to load ${url} (${response.status})`)
  }
  return response.text()
}

export async function loadBookmarkData(slug?: string): Promise<LoadedBookmarkPayload> {
  const apiUrl = slug ? `/api/data?u=${encodeURIComponent(slug)}` : '/api/data'
  try {
    const text = await readText(apiUrl)
    const parsed = parseDataJs(text)
    if (!parsed.sections.length) throw new Error('empty api data')
    return {
      ...parsed,
      source: 'api',
      viewer: extractViewer(text),
    }
  } catch {
    const text = await readText('/data.js')
    const parsed = parseDataJs(text)
    return {
      ...parsed,
      source: 'static',
      viewer: { isAdminView: true },
    }
  }
}
