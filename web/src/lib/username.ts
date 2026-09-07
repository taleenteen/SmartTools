const USERNAME_RE = /^[A-Za-z0-9_.-]{1,32}$/

export function isValidUsername(value: string): boolean {
  return typeof value === 'string' && USERNAME_RE.test(value)
}
