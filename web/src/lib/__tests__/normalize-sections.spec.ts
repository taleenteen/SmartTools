import { describe, expect, it } from 'vitest'

import { normalizeCard, normalizeSections, shouldShowSection, visibleCountFor } from '@/lib/normalize-sections'

describe('normalizeSections', () => {
  it('keeps builtin dynamic flags', () => {
    const sections = normalizeSections([
      { key: 'onlineAIData', builtin: true, kind: 'card', label: 'AI', visible: true, dynamic: false, cards: [{ title: 'A', url: 'https://a.test' }] },
    ])
    expect(sections[0]?.dynamic).toBe(true)
  })

  it('wraps legacy vars', () => {
    const sections = normalizeSections(undefined, {
      usbDriveData: [{ title: 'Disk', url: 'https://d.test' }],
      teachingData: [],
      customSections: [{ key: 'custom_x', label: 'Mine', cards: [{ title: 'X' }] }],
    })
    expect(sections.map((s) => s.key)).toContain('custom_x')
    expect(sections.find((s) => s.key === 'usbDriveData')?.cards[0]?.title).toBe('Disk')
  })

  it('hides empty card sections and keeps email', () => {
    const [cards, email] = normalizeSections([
      { key: 'usbDriveData', kind: 'card', builtin: true, cards: [] },
      { key: 'emailData', kind: 'email', builtin: true, cards: [] },
    ])
    expect(cards && shouldShowSection(cards)).toBe(false)
    expect(email && shouldShowSection(email)).toBe(true)
  })
})

describe('normalizeCard', () => {
  it('defaults expandable when subCards exist', () => {
    const card = normalizeCard({ title: 'Bundle', subCards: [{ title: 'A', url: 'https://a.test' }] })
    expect(card.type).toBe('expandable')
  })
})

describe('visibleCountFor', () => {
  it('caps video cards on mobile', () => {
    const [section] = normalizeSections([
      { key: 'videoData', builtin: true, kind: 'card', dynamic: true, cards: [] },
    ])
    expect(section && visibleCountFor(section, 'mobile')).toBe(4)
  })
})
