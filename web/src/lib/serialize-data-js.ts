import { encryptJSON, readSessionPassword } from '@/lib/crypto-sections'
import type { BookmarkSection, DataMeta } from '@/types/bookmark'

const HEADER = `/* data.js — bookmark data. Edit via Settings. */`

function nextVersion(prev?: string): { version: string; updatedAt: string } {
  const now = new Date()
  const iso = now.toISOString()
  const date = iso.slice(0, 10)
  let seq = 1
  const match = prev?.match(/^(\d{4}-\d{2}-\d{2})-(\d+)$/)
  if (match?.[1] === date && match[2]) seq = Number(match[2]) + 1
  return { version: `${date}-${String(seq).padStart(3, '0')}`, updatedAt: iso }
}

export class EncryptedSaveError extends Error {
  constructor() {
    super('encrypted-save-needs-password')
    this.name = 'EncryptedSaveError'
  }
}

export async function prepareSectionsForSave(sections: BookmarkSection[]): Promise<BookmarkSection[]> {
  const password = readSessionPassword()
  const out: BookmarkSection[] = []
  for (const section of sections) {
    if (!section.encrypted) {
      out.push({ ...section, enc: null })
      continue
    }
    const locked = !!section.enc && section.cards.length === 0
    if (locked) {
      out.push({ ...section, cards: [] })
      continue
    }
    if (!password) throw new EncryptedSaveError()
    const enc = await encryptJSON(password, section.cards)
    out.push({ ...section, enc, cards: [] })
  }
  return out
}

export function serializeDataJs(sections: BookmarkSection[], meta?: DataMeta | null): { text: string; meta: DataMeta } {
  const stamp = nextVersion(meta?.version)
  const nextMeta: DataMeta = { ...stamp, source: 'kv' }
  const body = JSON.stringify(sections, null, 2)
  const text = [
    HEADER,
    '',
    '/* __META_START__ */',
    'window.APP_DATA_META = {',
    `    version:   '${nextMeta.version}',`,
    `    updatedAt: '${nextMeta.updatedAt}',`,
    `    source:    'kv'`,
    '};',
    '/* __META_END__ */',
    '',
    `var sections = ${body};`,
    '',
  ].join('\n')
  return { text, meta: nextMeta }
}
