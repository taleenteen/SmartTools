import { describe, expect, it } from 'vitest'

import { parseDataJs } from '@/lib/parse-data-js'
import { serializeDataJs } from '@/lib/serialize-data-js'
import type { BookmarkSection } from '@/types/bookmark'

describe('serializeDataJs', () => {
  it('round-trips a simple section', () => {
    const sections: BookmarkSection[] = [
      {
        key: 'usbDriveData',
        kind: 'card',
        label: 'USB',
        builtin: true,
        visible: true,
        dynamic: false,
        cards: [{ title: 'Drive', url: 'https://example.test', type: 'simple' }],
      },
    ]
    const { text } = serializeDataJs(sections, { version: '2026-01-01-001' })
    const parsed = parseDataJs(text)
    expect(parsed.sections[0]?.key).toBe('usbDriveData')
    expect(parsed.sections[0]?.cards[0]?.title).toBe('Drive')
    expect(parsed.sections[0]?.cards[0]?.url).toBe('https://example.test')
    expect(parsed.meta?.source).toBe('kv')
  })
})
