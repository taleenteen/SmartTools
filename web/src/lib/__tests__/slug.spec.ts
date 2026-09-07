import { describe, expect, it } from 'vitest'

import {
  isReservedSlug,
  isValidSlug,
  requiredUsernameSubstringLen,
  slugContainsUsernameSubstring,
  slugIssue,
} from '@/lib/slug'

describe('slug validators', () => {
  it('enforces role length', () => {
    expect(isValidSlug('ab', 'user')).toBe(false)
    expect(isValidSlug('abc', 'user')).toBe(true)
    expect(isValidSlug('a', 'admin')).toBe(true)
    expect(isValidSlug('123', 'admin')).toBe(false)
  })

  it('rejects reserved words', () => {
    expect(isReservedSlug('admin')).toBe(true)
    expect(isReservedSlug('settings')).toBe(true)
    expect(isReservedSlug('alice-favs')).toBe(false)
  })

  it('requires a username substring for users', () => {
    expect(requiredUsernameSubstringLen('alice')).toBe(4)
    expect(slugContainsUsernameSubstring('alice-favs', 'alice')).toBe(true)
    expect(slugContainsUsernameSubstring('secret', 'alice')).toBe(false)
    expect(slugIssue('secret', 'user', 'alice')).toBe('substring')
    expect(slugIssue('alice-favs', 'user', 'alice')).toBe(null)
    expect(slugIssue('x', 'admin', 'admin')).toBe(null)
  })
})
