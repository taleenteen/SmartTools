import { describe, expect, it } from 'vitest'

import { applyCsvRows, csvToCardRows, sectionsToCsv } from '@/lib/csv'
import { sectionsToXlsx, xlsxToCardRows } from '@/lib/xlsx'
import type { BookmarkSection } from '@/types/bookmark'

const sample: BookmarkSection[] = [
  {
    key: 'videoData',
    kind: 'card',
    label: 'Video',
    builtin: true,
    visible: true,
    dynamic: true,
    cards: [{ id: 'c1', type: 'simple', title: 'Luna', url: 'https://example.test' }],
  },
]

describe('xlsx roundtrip', () => {
  it('exports a workbook that imports back to the same card', async () => {
    const blob = sectionsToXlsx(sample)
    const buffer = await blob.arrayBuffer()
    const rows = xlsxToCardRows(buffer)
    expect(rows[0]?.card.title).toBe('Luna')
    const next = applyCsvRows(sample, rows, 'overwrite')
    expect(next[0]?.cards[0]?.url).toBe('https://example.test')
  })

  it('csv helper still parses the same columns', () => {
    const rows = csvToCardRows(sectionsToCsv(sample))
    expect(rows).toHaveLength(1)
  })
})
