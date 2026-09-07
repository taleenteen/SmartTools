import { describe, expect, it } from 'vitest'

import { isValidUsername } from '@/lib/username'

describe('isValidUsername', () => {
  it('accepts letters, digits, underscore, hyphen, and dot', () => {
    expect(isValidUsername('alice')).toBe(true)
    expect(isValidUsername('A_1-b.c')).toBe(true)
    expect(isValidUsername('a'.repeat(32))).toBe(true)
  })

  it('rejects empty, too long, or illegal characters', () => {
    expect(isValidUsername('')).toBe(false)
    expect(isValidUsername('a'.repeat(33))).toBe(false)
    expect(isValidUsername('alice bob')).toBe(false)
    expect(isValidUsername('alice@x')).toBe(false)
  })
})
