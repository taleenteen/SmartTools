import { isEncryptedLocked } from '@/lib/normalize-sections'
import type { BookmarkCard, BookmarkSection, SubCard } from '@/types/bookmark'

type CsvCard = BookmarkCard & SubCard

const COLS = [
  'section_key',
  'card_id',
  'parent_card_id',
  'sub_index',
  'type',
  'title',
  'content',
  'url',
  'desc',
  'descClickable',
  'descUrl',
  'icon',
  'iconImg',
  'isLocal',
  'address',
  'mailto',
  'comment',
  'note',
] as const

function cell(value: unknown): string {
  const s = value == null ? '' : String(value)
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function row(values: unknown[]): string {
  return values.map(cell).join(',')
}

export function sectionsToCsv(sections: BookmarkSection[]): string {
  const lines = [COLS.join(',')]
  for (const section of sections) {
    if (isEncryptedLocked(section)) continue
    section.cards.forEach((card) => {
      lines.push(
        row([
          section.key,
          card.id,
          '',
          '',
          card.type,
          card.title,
          '',
          card.url,
          card.desc,
          card.descClickable,
          card.descUrl,
          card.icon,
          card.iconImg,
          card.isLocal ? 'true' : '',
          card.address,
          card.mailto,
          card.comment,
          '',
        ]),
      )
      ;(card.subCards || []).forEach((sub, index) => {
        lines.push(
          row([
            section.key,
            '',
            card.id,
            index,
            '',
            sub.title,
            sub.content,
            sub.url,
            sub.desc,
            '',
            '',
            sub.icon,
            sub.iconImg,
            sub.isLocal ? 'true' : '',
            '',
            '',
            sub.comment,
            sub.note,
          ]),
        )
      })
    })
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`
}

function parseLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') quoted = false
      else cur += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}

export function csvToCardRows(text: string): { sectionKey: string; card: CsvCard; parentId?: string }[] {
  const raw = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').split('\n').filter((line) => line.trim())
  if (raw.length < 2) return []
  const header = parseLine(raw[0] ?? '').map((h) => h.trim())
  const idx = (name: string) => header.indexOf(name)
  const rows: { sectionKey: string; card: CsvCard; parentId?: string }[] = []
  for (const line of raw.slice(1)) {
    const cols = parseLine(line)
    const get = (name: string) => cols[idx(name)] || ''
    const sectionKey = get('section_key')
    if (!sectionKey) continue
    const parentId = get('parent_card_id') || undefined
    const card: CsvCard = {
      id: get('card_id') || undefined,
      type: (get('type') as BookmarkCard['type']) || undefined,
      title: get('title') || undefined,
      content: get('content') || undefined,
      url: get('url') || undefined,
      desc: get('desc') || undefined,
      descClickable: get('descClickable') || undefined,
      descUrl: get('descUrl') || undefined,
      icon: get('icon') || undefined,
      iconImg: get('iconImg') || undefined,
      isLocal: get('isLocal') === 'true',
      address: get('address') || undefined,
      mailto: get('mailto') || undefined,
      comment: get('comment') || undefined,
      note: get('note') || undefined,
    }
    rows.push({ sectionKey, card, parentId })
  }
  return rows
}

export function applyCsvRows(
  sections: BookmarkSection[],
  rows: { sectionKey: string; card: CsvCard; parentId?: string }[],
  mode: 'append' | 'overwrite',
): BookmarkSection[] {
  const next = sections.map((section) => ({ ...section, cards: [...section.cards] }))
  const byKey = new Map(next.map((section) => [section.key, section]))
  for (const rowItem of rows) {
    const section = byKey.get(rowItem.sectionKey)
    if (!section) continue
    if (rowItem.parentId) {
      const parent = section.cards.find((card) => card.id === rowItem.parentId)
      if (!parent) continue
      parent.subCards = [...(parent.subCards || []), rowItem.card]
      continue
    }
    if (mode === 'overwrite' && rowItem.card.id) {
      const index = section.cards.findIndex((card) => card.id === rowItem.card.id)
      if (index >= 0) {
        section.cards[index] = rowItem.card
        continue
      }
    }
    section.cards.push(rowItem.card)
  }
  return next
}
