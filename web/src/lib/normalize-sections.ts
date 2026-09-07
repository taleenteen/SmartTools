import { t } from '@/i18n/th'
import {
  BUILTIN_DYNAMIC,
  type BookmarkCard,
  type BookmarkSection,
  type CardType,
  type SectionKind,
  type SubCard,
} from '@/types/bookmark'

const CARD_KINDS: SectionKind[] = ['card', 'email', 'contact']
const CARD_TYPES: CardType[] = ['simple', 'desc-clickable', 'expandable']

const CARD_DEFS = [
  { key: 'usbDriveData', kind: 'card' as const, label: t.builtinUsb, dynamic: false },
  { key: 'teachingData', kind: 'card' as const, label: t.builtinTeaching, dynamic: false },
  { key: 'onlineAIData', kind: 'card' as const, label: t.builtinNetwork, dynamic: true },
  { key: 'videoData', kind: 'card' as const, label: t.builtinVideo, dynamic: true },
]

const CONTACT_DEFS = [
  { key: 'emailData', kind: 'email' as const, label: t.builtinEmail, dynamic: false },
  { key: 'contactData', kind: 'contact' as const, label: t.builtinContact, dynamic: false },
]

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function asBool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function asKind(value: unknown): SectionKind {
  return CARD_KINDS.includes(value as SectionKind) ? (value as SectionKind) : 'card'
}

function asType(value: unknown): CardType | undefined {
  return CARD_TYPES.includes(value as CardType) ? (value as CardType) : undefined
}

function normalizeSubCard(raw: unknown): SubCard {
  const row = asRecord(raw) ?? {}
  return {
    id: asString(row.id),
    icon: asString(row.icon),
    iconImg: asString(row.iconImg),
    title: asString(row.title),
    desc: asString(row.desc),
    content: asString(row.content),
    note: asString(row.note),
    url: asString(row.url),
    isLocal: asBool(row.isLocal),
    comment: asString(row.comment),
  }
}

export function normalizeCard(raw: unknown): BookmarkCard {
  const row = asRecord(raw) ?? {}
  const subCards = Array.isArray(row.subCards) ? row.subCards.map(normalizeSubCard) : undefined
  return {
    id: asString(row.id),
    type: asType(row.type) ?? (subCards?.length ? 'expandable' : 'simple'),
    icon: asString(row.icon),
    iconImg: asString(row.iconImg),
    title: asString(row.title),
    desc: asString(row.desc),
    descClickable: asString(row.descClickable),
    descUrl: asString(row.descUrl),
    url: asString(row.url),
    isLocal: asBool(row.isLocal),
    comment: asString(row.comment),
    address: asString(row.address),
    mailto: asString(row.mailto),
    subCards,
    pushedBy: asString(row.pushedBy),
    pushedAt: asString(row.pushedAt),
  }
}

function normalizeSection(raw: unknown, index: number): BookmarkSection | null {
  const row = asRecord(raw)
  if (!row) return null
  const key = asString(row.key) ?? `section_${index}`
  const builtin = asBool(row.builtin)
  const kind = asKind(row.kind)
  const dynamicDefault = builtin ? !!BUILTIN_DYNAMIC[key] : asBool(row.dynamic)
  return {
    key,
    kind,
    label: asString(row.label) ?? key,
    builtin,
    visible: row.visible === false ? false : true,
    dynamic: builtin && key in BUILTIN_DYNAMIC ? dynamicDefault : asBool(row.dynamic),
    encrypted: asBool(row.encrypted),
    enc: asRecord(row.enc) as BookmarkSection['enc'],
    anchor: asString(row.anchor),
    cards: Array.isArray(row.cards) ? row.cards.map(normalizeCard) : [],
  }
}

export function isEncryptedLocked(section: BookmarkSection): boolean {
  return !!section.encrypted && !section.cards.length && !!section.enc?.data
}

export function shouldShowSection(section: BookmarkSection): boolean {
  if (section.visible === false) return false
  if (section.kind === 'email' || section.kind === 'contact') return true
  if (isEncryptedLocked(section)) {
    return (section.enc?.data?.length ?? 0) > 36
  }
  return section.cards.length > 0
}

function fromLegacyVars(global: Record<string, unknown>): BookmarkSection[] {
  const out: BookmarkSection[] = []
  for (const def of CARD_DEFS) {
    const cards = Array.isArray(global[def.key]) ? (global[def.key] as unknown[]).map(normalizeCard) : []
    out.push({
      key: def.key,
      kind: def.kind,
      label: def.label,
      builtin: true,
      visible: true,
      dynamic: def.dynamic,
      cards,
    })
  }
  if (Array.isArray(global.customSections)) {
    global.customSections.forEach((item, i) => {
      const section = normalizeSection(item, i)
      if (section) {
        section.builtin = false
        section.kind = 'card'
        out.push(section)
      }
    })
  }
  for (const def of CONTACT_DEFS) {
    const cards = Array.isArray(global[def.key]) ? (global[def.key] as unknown[]).map(normalizeCard) : []
    out.push({
      key: def.key,
      kind: def.kind,
      label: def.label,
      builtin: true,
      visible: true,
      dynamic: false,
      cards,
    })
  }
  return out
}

export function normalizeSections(input: unknown, legacyVars?: Record<string, unknown>): BookmarkSection[] {
  if (Array.isArray(input)) {
    return input
      .map((row, i) => normalizeSection(row, i))
      .filter((row): row is BookmarkSection => row !== null)
      .map((section) => {
        if (section.builtin && section.key in BUILTIN_DYNAMIC) {
          section.dynamic = BUILTIN_DYNAMIC[section.key] ?? section.dynamic
        }
        return section
      })
  }
  if (legacyVars) return fromLegacyVars(legacyVars)
  return []
}

export function visibleCountFor(section: BookmarkSection, layout: 'mobile' | 'tablet' | 'desktop'): number {
  if (!section.dynamic) return Number.POSITIVE_INFINITY
  if (section.key === 'videoData' || section.key.startsWith('custom_')) {
    if (layout === 'mobile') return 4
    if (layout === 'tablet') return 6
    return 8
  }
  if (section.key === 'onlineAIData') return layout === 'tablet' ? 3 : 4
  if (layout === 'mobile') return 4
  if (layout === 'tablet') return 6
  return 8
}

export function detectLayout(width = typeof window === 'undefined' ? 400 : window.innerWidth): 'mobile' | 'tablet' | 'desktop' {
  if (width >= 900) return 'desktop'
  if (width >= 640) return 'tablet'
  return 'mobile'
}

export function cardIdentity(card: BookmarkCard, fallback: string): string {
  return card.id || fallback
}
