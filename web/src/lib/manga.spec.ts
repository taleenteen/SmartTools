import { describe, expect, it } from 'vitest'
import {
  detectChapterPattern,
  ensureMangaSection,
  itemToMangaCard,
  mangaCardToItem,
  MANGA_SECTION_KEY,
  parseChapterNumber,
  resolveChapterUrl,
  type MangaItem,
} from './manga'
import type { BookmarkCard, BookmarkSection } from '@/types/bookmark'

describe('manga domain logic & URL pattern engine', () => {
  describe('detectChapterPattern', () => {
    it('detects chapter and creates pattern for Thai URL with encoded characters', () => {
      const url = 'https://www.go-manga.com/revenge-iron-blooded-%E0%B8%95%E0%B8%AD%E0%B8%99%E0%B8%97%E0%B8%B5%E0%B9%88-80/'
      const res = detectChapterPattern(url)
      expect(res.detectedChapter).toBe(80)
      expect(res.pattern).toBe('https://www.go-manga.com/revenge-iron-blooded-ตอนที่-{chapter}/')
    })

    it('detects chapter for standard chapter- prefix', () => {
      const url = 'https://example.com/read/solo-leveling/chapter-179/'
      const res = detectChapterPattern(url)
      expect(res.detectedChapter).toBe(179)
      expect(res.pattern).toBe('https://example.com/read/solo-leveling/chapter-{chapter}/')
    })

    it('detects chapter for ch- prefix without trailing slash', () => {
      const url = 'https://manga.xyz/one-piece/ch-1100'
      const res = detectChapterPattern(url)
      expect(res.detectedChapter).toBe(1100)
      expect(res.pattern).toBe('https://manga.xyz/one-piece/ch-{chapter}')
    })

    it('preserves existing {chapter} placeholder', () => {
      const url = 'https://manga.xyz/read/{chapter}/'
      const res = detectChapterPattern(url)
      expect(res.pattern).toBe('https://manga.xyz/read/{chapter}/')
    })

    it('handles decimal chapters like 80.5', () => {
      const url = 'https://example.com/series/ตอนที่-80.5/'
      const res = detectChapterPattern(url)
      expect(res.detectedChapter).toBe(80.5)
      expect(res.pattern).toBe('https://example.com/series/ตอนที่-{chapter}/')
    })
  })

  describe('resolveChapterUrl', () => {
    it('interpolates chapter number into {chapter} placeholder', () => {
      const pattern = 'https://www.go-manga.com/revenge-iron-blooded-ตอนที่-{chapter}/'
      const url = resolveChapterUrl(pattern, 81)
      expect(url).toBe('https://www.go-manga.com/revenge-iron-blooded-ตอนที่-81/')
    })

    it('respects manual override URL if provided', () => {
      const pattern = 'https://www.go-manga.com/revenge-iron-blooded-ตอนที่-{chapter}/'
      const override = 'https://www.go-manga.com/revenge-iron-blooded-special-anniversary/'
      const url = resolveChapterUrl(pattern, 81, override)
      expect(url).toBe(override)
    })

    it('replaces trailing numbers if placeholder was missing', () => {
      const pattern = 'https://site.com/series/ep-80/'
      const url = resolveChapterUrl(pattern, 81)
      expect(url).toBe('https://site.com/series/ep-81/')
    })
  })

  describe('parseChapterNumber', () => {
    it('parses number from Thai string', () => {
      expect(parseChapterNumber('ตอนที่ 80')).toBe(80)
      expect(parseChapterNumber('ตอน 125.5')).toBe(125.5)
      expect(parseChapterNumber('Ch. 99')).toBe(99)
      expect(parseChapterNumber('42')).toBe(42)
      expect(parseChapterNumber(50)).toBe(50)
      expect(parseChapterNumber('')).toBe(1)
      expect(parseChapterNumber(null)).toBe(1)
    })
  })

  describe('card serialization and deserialization', () => {
    it('correctly maps MangaItem to BookmarkCard and back', () => {
      const item: MangaItem = {
        id: 'manga_1',
        title: 'Revenge of the Iron-Blooded Sword Hound',
        coverUrl: 'data:image/webp;base64,mockCover',
        currentChapter: 80,
        urlPattern: 'https://www.go-manga.com/revenge-iron-blooded-ตอนที่-{chapter}/',
        note: 'Very fun manhwa',
      }

      const card = itemToMangaCard(item)
      expect(card.title).toBe(item.title)
      expect(card.desc).toBe('ตอนที่ 80')
      expect(card.descUrl).toBe(item.urlPattern)
      expect(card.url).toBe('https://www.go-manga.com/revenge-iron-blooded-ตอนที่-80/')
      expect(card.iconImg).toBe(item.coverUrl)
      expect(card.comment).toBe(item.note)

      const back = mangaCardToItem(card)
      expect(back.id).toBe(item.id)
      expect(back.title).toBe(item.title)
      expect(back.currentChapter).toBe(80)
      expect(back.urlPattern).toBe(item.urlPattern)
      expect(back.coverUrl).toBe(item.coverUrl)
      expect(back.note).toBe(item.note)
    })
  })

  describe('ensureMangaSection', () => {
    it('creates custom_manga section if absent', () => {
      const sections: BookmarkSection[] = []
      const res = ensureMangaSection(sections)
      expect(res.sections.length).toBe(1)
      expect(res.mangaSection.key).toBe(MANGA_SECTION_KEY)
      expect(res.mangaSection.label).toBe('Manga')
    })

    it('returns existing custom_manga section if already present', () => {
      const existing: BookmarkSection = {
        key: MANGA_SECTION_KEY,
        kind: 'card',
        label: 'Manga',
        builtin: false,
        visible: true,
        dynamic: false,
        cards: [{ title: 'Solo Leveling' } as BookmarkCard],
      }
      const res = ensureMangaSection([existing])
      expect(res.sections.length).toBe(1)
      expect(res.mangaSection.cards.length).toBe(1)
    })
  })
})
