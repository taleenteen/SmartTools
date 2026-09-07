import { describe, expect, it } from 'vitest'

import { parseDataJs } from '@/lib/parse-data-js'

describe('parseDataJs', () => {
  it('reads a modern sections payload', () => {
    const source = `
      window.APP_DATA_META = { version: 'test', source: 'static' };
      var sections = [
        { key: 'usbDriveData', kind: 'card', builtin: true, label: 'USB', visible: true, cards: [
          { title: 'Drive', url: 'https://example.test', type: 'simple' }
        ]}
      ];
    `
    const parsed = parseDataJs(source)
    expect(parsed.meta?.version).toBe('test')
    expect(parsed.sections[0]?.cards[0]?.title).toBe('Drive')
  })
})
