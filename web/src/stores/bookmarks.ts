import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { storageLoad } from '@/lib/storage'
import { normalizeCard, shouldShowSection } from '@/lib/normalize-sections'
import { t } from '@/i18n/th'
import type { BookmarkCard, BookmarkSection, LoadStatus } from '@/types/bookmark'

export const useBookmarksStore = defineStore('bookmarks', () => {
  const sections = ref<BookmarkSection[]>([])
  const status = ref<LoadStatus>('idle')
  const error = ref<string | null>(null)
  const source = ref<'api' | 'static' | 'folder' | null>(null)

  const visibleSections = computed(() => sections.value.filter(shouldShowSection))

  async function load(slug?: string) {
    status.value = 'loading'
    error.value = null
    try {
      const payload = await storageLoad(slug)
      sections.value = payload.sections
      source.value = payload.source
      status.value = 'ready'
      return payload
    } catch (err) {
      error.value = err instanceof Error ? err.message : t.loadErrorBody
      status.value = 'error'
      throw err
    }
  }

  function replaceCards(key: string, cards: BookmarkCard[]) {
    sections.value = sections.value.map((section) =>
      section.key === key ? { ...section, cards } : section,
    )
  }

  function clearDecrypted() {
    sections.value = sections.value.map((section) =>
      section.encrypted ? { ...section, cards: [] } : section,
    )
  }

  function hydrateCards(raw: unknown): BookmarkCard[] {
    return Array.isArray(raw) ? raw.map(normalizeCard) : []
  }

  return { sections, visibleSections, status, error, source, load, replaceCards, clearDecrypted, hydrateCards }
})
