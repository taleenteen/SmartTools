import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'

import {
  DEFAULT_THEME,
  LEGACY_PAGE_TO_THEME,
  LEGACY_THEME_STORAGE_KEY,
  THEME_STORAGE_KEY,
  THEMES,
  type ThemeId,
  isThemeId,
} from '@/types/theme'

function readStoredTheme(): ThemeId {
  try {
    const next = localStorage.getItem(THEME_STORAGE_KEY)
    if (isThemeId(next)) return next

    const legacy = localStorage.getItem(LEGACY_THEME_STORAGE_KEY)
    if (legacy && LEGACY_PAGE_TO_THEME[legacy]) return LEGACY_PAGE_TO_THEME[legacy]
  } catch {
    /* private mode / SSR */
  }
  return DEFAULT_THEME
}

function applyTheme(id: ThemeId) {
  const root = document.documentElement
  root.setAttribute('data-theme', id)
  root.classList.toggle('dark', id === 'stripe' || id === 'dark')
}

export const useThemeStore = defineStore('theme', () => {
  const id = ref<ThemeId>(DEFAULT_THEME)
  const list = THEMES
  const current = computed(
    () => list.find((theme) => theme.id === id.value) ?? list.find((theme) => theme.id === DEFAULT_THEME)!,
  )

  function setTheme(next: ThemeId) {
    id.value = next
  }

  function hydrateFromUrl() {
    const params = new URLSearchParams(window.location.search)
    const fromQuery = params.get('theme')
    if (isThemeId(fromQuery)) {
      setTheme(fromQuery)
      return
    }
    setTheme(readStoredTheme())
  }

  watch(
    id,
    (next) => {
      applyTheme(next)
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next)
      } catch {
        /* ignore quota / private mode */
      }
    },
    { immediate: true },
  )

  return { id, list, current, setTheme, hydrateFromUrl }
})
