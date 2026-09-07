import { normalizeSections } from '@/lib/normalize-sections'
import type { BookmarkSection, DataMeta } from '@/types/bookmark'

export interface ParsedBookmarkData {
  sections: BookmarkSection[]
  meta: DataMeta | null
}

/**
 * Execute trusted data.js from our own API/KV/static file.
 * The payload is app-authored JS, not user HTML.
 */
export function parseDataJs(source: string): ParsedBookmarkData {
  const sandbox: Record<string, unknown> = {}
  const runner = new Function(
    'window',
    `${source}\n; return {\n  sections: typeof sections !== 'undefined' ? sections : window.sections,\n  usbDriveData: typeof usbDriveData !== 'undefined' ? usbDriveData : window.usbDriveData,\n  teachingData: typeof teachingData !== 'undefined' ? teachingData : window.teachingData,\n  onlineAIData: typeof onlineAIData !== 'undefined' ? onlineAIData : window.onlineAIData,\n  videoData: typeof videoData !== 'undefined' ? videoData : window.videoData,\n  emailData: typeof emailData !== 'undefined' ? emailData : window.emailData,\n  contactData: typeof contactData !== 'undefined' ? contactData : window.contactData,\n  customSections: typeof customSections !== 'undefined' ? customSections : window.customSections,\n  meta: window.APP_DATA_META || null\n};`,
  ) as (windowObj: Record<string, unknown>) => Record<string, unknown>

  const result = runner(sandbox)
  const sections = normalizeSections(result.sections, result)
  const meta = (result.meta && typeof result.meta === 'object' ? result.meta : null) as DataMeta | null
  return { sections, meta }
}
