export const THEME_IDS = ['notion', 'nebula', 'stripe', 'dark', 'mint'] as const

export type ThemeId = (typeof THEME_IDS)[number]

export interface ThemeMeta {
  id: ThemeId
  label: string
  emoji: string
}

export const THEMES: readonly ThemeMeta[] = [
  { id: 'nebula', label: 'Nebula', emoji: '🌌' },
  { id: 'notion', label: 'Notion', emoji: '📄' },
  { id: 'stripe', label: 'Stripe', emoji: '💎' },
  { id: 'dark', label: 'Framer', emoji: '🖤' },
  { id: 'mint', label: 'Mintlify', emoji: '🌿' },
] as const

export const DEFAULT_THEME: ThemeId = 'notion'

export const THEME_STORAGE_KEY = 'smarttools-theme'
export const LEGACY_THEME_STORAGE_KEY = 'fav_last_style'

export const LEGACY_PAGE_TO_THEME: Record<string, ThemeId> = {
  'index1.html': 'nebula',
  'index2.html': 'notion',
  'index3.html': 'stripe',
  'index4.html': 'dark',
  'index5.html': 'mint',
}

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return THEME_IDS.includes(value as ThemeId)
}
