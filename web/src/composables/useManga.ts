import { computed } from 'vue'

import {
  ensureMangaSection,
  itemToMangaCard,
  mangaCardToItem,
  MANGA_SECTION_KEY,
  type MangaItem,
} from '@/lib/manga'
import { useBookmarksStore } from '@/stores/bookmarks'
import { useEditorStore } from '@/stores/editor'
import type { BookmarkCard } from '@/types/bookmark'

export function useManga() {
  const bookmarks = useBookmarksStore()
  const editor = useEditorStore()

  const mangaCards = computed<BookmarkCard[]>(() => {
    if (editor.sections.length > 0) {
      const section = editor.sections.find((s) => s.key === MANGA_SECTION_KEY)
      if (section) return section.cards
    }
    const section = bookmarks.sections.find((s) => s.key === MANGA_SECTION_KEY)
    return section?.cards || []
  })

  const mangaList = computed<MangaItem[]>(() => {
    return mangaCards.value.map(mangaCardToItem)
  })

  async function syncEditor() {
    if (editor.status !== 'ready') {
      await editor.load()
    }
  }

  async function saveManga(item: MangaItem) {
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

    editor.sections = sections.map((s) =>
      s.key === MANGA_SECTION_KEY ? { ...s, cards: updatedCards } : s,
    )
    editor.dirty = true
    await editor.save()

    bookmarks.replaceCards(MANGA_SECTION_KEY, updatedCards)
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
    await syncEditor()
    const { sections, mangaSection } = ensureMangaSection(editor.sections)
    const updatedCards = mangaSection.cards.filter((c) => c.id !== id)
    editor.sections = sections.map((s) =>
      s.key === MANGA_SECTION_KEY ? { ...s, cards: updatedCards } : s,
    )
    editor.dirty = true
    await editor.save()

    bookmarks.replaceCards(MANGA_SECTION_KEY, updatedCards)
  }

  return {
    mangaList,
    saveManga,
    stepChapter,
    updateChapter,
    removeManga,
  }
}
