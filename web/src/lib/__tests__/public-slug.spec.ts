import { describe, expect, it } from 'vitest'

import { readPublicSlug } from '@/lib/public-slug'

describe('readPublicSlug', () => {
  it('reads /@slug', () => {
    window.history.replaceState({}, '', '/@alice')
    expect(readPublicSlug()).toBe('alice')
  })

  it('reads ?u=', () => {
    window.history.replaceState({}, '', '/?u=bob')
    expect(readPublicSlug()).toBe('bob')
  })
})
