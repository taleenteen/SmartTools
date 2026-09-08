import type { BookmarkCard, BookmarkSection } from '@/types/bookmark'

export const MANGA_SECTION_KEY = 'custom_manga'
export const MANGA_SECTION_LABEL = 'Manga'

export interface MangaItem {
  id: string
  title: string
  coverUrl: string
  currentChapter: number
  urlPattern: string
  latestUrl?: string
  note?: string
  updatedAt?: string
}

/**
 * Safely decodes URI components while tolerating malformed URI encoding.
 */
export function safeDecodeUri(url: string): string {
  try {
    return decodeURI(url)
  } catch {
    return url
  }
}

/**
 * Extracts a numeric chapter value from a string (e.g. "ตอนที่ 80", "Ch. 80", "80").
 */
export function parseChapterNumber(raw?: string | number | null): number {
  if (typeof raw === 'number') return Math.max(1, Math.floor(raw))
  if (!raw) return 1
  const clean = String(raw).trim()
  const match = clean.match(/(\d+(?:\.\d+)?)/)
  if (match?.[1]) {
    const num = parseFloat(match[1])
    return Number.isFinite(num) ? num : 1
  }
  return 1
}

/**
 * Automatically inspects a manga chapter URL, decodes Thai/URL-encoded slugs,
 * and detects the trailing chapter number to convert into a `{chapter}` template.
 *
 * Example:
 * Input:  "https://www.go-manga.com/revenge-iron-blooded-%E0%B8%95%E0%B8%AD%E0%B8%99%E0%B8%97%E0%B8%B5%E0%B9%88-80/"
 * Output: { detectedChapter: 80, pattern: "https://www.go-manga.com/revenge-iron-blooded-ตอนที่-{chapter}/" }
 */
export function detectChapterPattern(rawUrl: string): { detectedChapter: number; pattern: string } {
  const url = safeDecodeUri(rawUrl.trim())
  if (!url) return { detectedChapter: 1, pattern: '' }

  // If already contains placeholder
  if (/\{chapter\}|\{ch\}/i.test(url)) {
    return {
      detectedChapter: 1,
      pattern: url.replace(/\{ch\}/i, '{chapter}'),
    }
  }

  // Regex to match trailing chapter sequence:
  // e.g. /ตอนที่-80/, -ตอนที่-80, /chapter-80/, /ch-80/, /ep-80/, /80/, /80
  const match = url.match(/^(.*?(?:ตอนที่-|chapter-|ch-|ep-|-|\/))(\d+(?:\.\d+)?)(\/?)$/i)
  if (match && match[1] !== undefined && match[2] !== undefined) {
    const prefix = match[1]
    const chapterNum = parseFloat(match[2])
    const suffix = match[3] || ''
    return {
      detectedChapter: Number.isFinite(chapterNum) ? chapterNum : 1,
      pattern: `${prefix}{chapter}${suffix}`,
    }
  }

  // Fallback: search for any last numeric sequence
  const lastNumMatch = url.match(/^(.*?)(\d+(?:\.\d+)?)(\/?)$/)
  if (lastNumMatch && lastNumMatch[1] !== undefined && lastNumMatch[2] !== undefined) {
    const prefix = lastNumMatch[1]
    const chapterNum = parseFloat(lastNumMatch[2])
    const suffix = lastNumMatch[3] || ''
    return {
      detectedChapter: Number.isFinite(chapterNum) ? chapterNum : 1,
      pattern: `${prefix}{chapter}${suffix}`,
    }
  }

  return { detectedChapter: 1, pattern: url }
}

/**
 * Resolves the target chapter URL from a pattern and chapter number.
 */
export function resolveChapterUrl(pattern: string, chapter: number | string, overrideUrl?: string): string {
  if (overrideUrl && overrideUrl.trim()) {
    return overrideUrl.trim()
  }

  const rawPattern = safeDecodeUri(pattern.trim())
  if (!rawPattern) return ''

  const chStr = String(chapter)

  if (/\{chapter\}|\{ch\}/i.test(rawPattern)) {
    return rawPattern.replace(/\{chapter\}|\{ch\}/gi, chStr)
  }

  // If pattern still ends in digits, replace the trailing digits
  const lastDigitsMatch = rawPattern.match(/^(.*?)(\d+(?:\.\d+)?)(\/?)$/)
  if (lastDigitsMatch) {
    return `${lastDigitsMatch[1]}${chStr}${lastDigitsMatch[3] || ''}`
  }

  return rawPattern
}

/**
 * Maps a generic BookmarkCard in custom_manga section to a typed MangaItem.
 */
export function mangaCardToItem(card: BookmarkCard): MangaItem {
  const currentChapter = parseChapterNumber(card.desc)
  const urlPattern = card.descUrl || card.url || ''
  const computedUrl = resolveChapterUrl(urlPattern, currentChapter)

  return {
    id: card.id || `manga_${Math.random().toString(36).slice(2, 9)}`,
    title: card.title || '',
    coverUrl: card.iconImg || '',
    currentChapter,
    urlPattern,
    latestUrl: card.url && card.url !== computedUrl ? card.url : undefined,
    note: card.comment || '',
    updatedAt: card.pushedAt,
  }
}

/**
 * Serializes a MangaItem into a standard BookmarkCard without inventing schema fields.
 */
export function itemToMangaCard(item: MangaItem): BookmarkCard {
  const currentUrl = item.latestUrl?.trim() || resolveChapterUrl(item.urlPattern, item.currentChapter)

  return {
    id: item.id || `manga_${Math.random().toString(36).slice(2, 9)}`,
    type: 'simple',
    title: item.title.trim(),
    desc: `ตอนที่ ${item.currentChapter}`,
    descUrl: item.urlPattern.trim(),
    url: currentUrl,
    iconImg: item.coverUrl.trim(),
    comment: item.note?.trim() || '',
    pushedAt: new Date().toISOString(),
  }
}

/**
 * Ensures the manga section exists within an array of bookmark sections.
 */
export function ensureMangaSection(sections: BookmarkSection[]): {
  sections: BookmarkSection[]
  mangaSection: BookmarkSection
} {
  const existing = sections.find((s) => s.key === MANGA_SECTION_KEY)
  if (existing) {
    return { sections, mangaSection: existing }
  }

  const newSection: BookmarkSection = {
    key: MANGA_SECTION_KEY,
    kind: 'card',
    label: MANGA_SECTION_LABEL,
    builtin: false,
    visible: true,
    dynamic: false,
    cards: [],
  }

  return {
    sections: [...sections, newSection],
    mangaSection: newSection,
  }
}
