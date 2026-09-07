import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

import { useThemeStore } from '@/stores/theme'

describe('theme store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.classList.remove('dark')
  })

  it('applies a theme to the document', async () => {
    const theme = useThemeStore()
    theme.setTheme('stripe')
    await nextTick()
    expect(document.documentElement.getAttribute('data-theme')).toBe('stripe')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('smarttools-theme')).toBe('stripe')
  })

  it('hydrates from the query string', () => {
    const theme = useThemeStore()
    window.history.replaceState({}, '', '/?theme=mint')
    theme.hydrateFromUrl()
    expect(theme.id).toBe('mint')
  })
})
