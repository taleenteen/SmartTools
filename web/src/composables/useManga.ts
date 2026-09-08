import { computed } from 'vue'

import { t } from '@/i18n/th'
import {
  ensureMangaSection,
  itemToMangaCard,
  mangaCardToItem,
  MANGA_SECTION_KEY,
  type MangaItem,
} from '@/lib/manga'
import { useBookmarksStore } from '@/stores/bookmarks'
import { useEditorStore } from '@/stores/editor'
import { useModeStore } from '@/stores/mode'
import { useSessionStore } from '@/stores/session'
import type { BookmarkCard } from '@/types/bookmark'

const CACHE_KEY = 'smarttools-manga-cache'

function loadLocalMangaCache(): BookmarkCard[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveLocalMangaCache(cards: BookmarkCard[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cards))
  } catch {
    /* ignore quota or private mode errors */
  }
}

export function useManga() {
  const bookmarks = useBookmarksStore()
  const editor = useEditorStore()
  const session = useSessionStore()
  const mode = useModeStore()

  const mangaCards = computed<BookmarkCard[]>(() => {
    // 1. Check editor store (authenticated / admin edit state)
    if (editor.sections.length > 0) {
      const section = editor.sections.find((s) => s.key === MANGA_SECTION_KEY)
      if (section) {
        if (section.cards.length > 0) {
          saveLocalMangaCache(section.cards)
        }
        return section.cards
      }
    }

    // 2. Check bookmarks store (loaded public or static data)
    if (bookmarks.sections.length > 0) {
      const section = bookmarks.sections.find((s) => s.key === MANGA_SECTION_KEY)
      if (section) {
        if (section.cards.length > 0) {
          saveLocalMangaCache(section.cards)
        }
        return section.cards
      }
    }

    // 3. Fallback to localStorage cache (e.g. before login check finishes or offline)
    return loadLocalMangaCache()
  })

  const mangaList = computed<MangaItem[]>(() => {
    return mangaCards.value.map(mangaCardToItem)
  })

  async function syncEditor() {
    if (editor.status !== 'ready') {
      await editor.load()
    }
  }

  function syncBookmarksMangaCards(cards: BookmarkCard[]) {
    const bmSection = bookmarks.sections.find((s) => s.key === MANGA_SECTION_KEY)
    if (bmSection) {
      bookmarks.replaceCards(MANGA_SECTION_KEY, cards)
    } else if (bookmarks.sections.length > 0) {
      const { sections: bmSections } = ensureMangaSection(bookmarks.sections)
      bookmarks.sections = bmSections.map((s) =>
        s.key === MANGA_SECTION_KEY ? { ...s, cards } : s,
      )
    }
  }

  async function saveManga(item: MangaItem) {
    const isLocal = mode.kind === 'local'
    const canSaveOnline = session.loggedIn

    if (!isLocal && !canSaveOnline) {
      throw new Error(t.mangaNeedLogin)
    }

    await syncEditor()
    const { sections, mangaSection } = ensureMangaSection(editor.sections)
    const card = itemToMangaCard(item)
    const existingIndex = mangaSection.cards.findIndex((c) => c.id === item.id)

    let updatedCards: BookmarkCard[]
    if (existingIndex >= 0) {
      updatedCards = mangaSection.cards.map((c, i) => (i === existingIndex ? card : c))
    } else {
      updatedCards = [...mangaSection.cards, card]
    }

    const prevSections = editor.sections
    editor.sections = sections.map((s) =>
      s.key === MANGA_SECTION_KEY ? { ...s, cards: updatedCards } : s,
    )
    editor.dirty = true

    try {
      await editor.save()
      saveLocalMangaCache(updatedCards)
      syncBookmarksMangaCards(updatedCards)
    } catch (err) {
      editor.sections = prevSections
      editor.dirty = false
      throw err
    }
  }

  async function stepChapter(id: string, delta: number) {
    const item = mangaList.value.find((m) => m.id === id)
    if (!item) return
    const nextChapter = Math.max(1, item.currentChapter + delta)
    await updateChapter(id, nextChapter)
  }

  async function updateChapter(id: string, chapter: number, overrideUrl?: string) {
    const item = mangaList.value.find((m) => m.id === id)
    if (!item) return
    const updated: MangaItem = {
      ...item,
      currentChapter: chapter,
      latestUrl: overrideUrl,
      updatedAt: new Date().toISOString(),
    }
    await saveManga(updated)
  }

  async function removeManga(id: string) {
    const isLocal = mode.kind === 'local'
    const canSaveOnline = session.loggedIn

    if (!isLocal && !canSaveOnline) {
      throw new Error(t.mangaNeedLogin)
    }

    await syncEditor()
    const { sections, mangaSection } = ensureMangaSection(editor.sections)
    const updatedCards = mangaSection.cards.filter((c) => c.id !== id)

    const prevSections = editor.sections
    editor.sections = sections.map((s) =>
      s.key === MANGA_SECTION_KEY ? { ...s, cards: updatedCards } : s,
    )
    editor.dirty = true

    try {
      await editor.save()
      saveLocalMangaCache(updatedCards)
      syncBookmarksMangaCards(updatedCards)
    } catch (err) {
      editor.sections = prevSections
      editor.dirty = false
      throw err
    }
  }

  return {
    mangaCards,
    mangaList,
    saveManga,
    stepChapter,
    updateChapter,
    removeManga,
  }
}
