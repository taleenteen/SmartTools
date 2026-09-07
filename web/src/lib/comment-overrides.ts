export const COMMENT_OVERRIDES_KEY = 'bm_comment_overrides'

export function readCommentOverrides(): Record<string, string> {
  try {
    const raw = localStorage.getItem(COMMENT_OVERRIDES_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as Record<string, string>
  } catch {
    return {}
  }
}

export function writeCommentOverride(cardId: string, comment: string) {
  const map = readCommentOverrides()
  map[cardId] = comment
  localStorage.setItem(COMMENT_OVERRIDES_KEY, JSON.stringify(map))
}

export function effectiveComment(card: { comment?: string }, cardId: string): string {
  const overrides = readCommentOverrides()
  if (Object.prototype.hasOwnProperty.call(overrides, cardId)) return overrides[cardId] ?? ''
  return card.comment ?? ''
}
