import { cardIdentity } from '@/lib/normalize-sections'
import type { BookmarkSection } from '@/types/bookmark'

export function commentPathForCard(
  sections: BookmarkSection[],
  cardId: string,
): (string | number)[] | null {
  for (let si = 0; si < sections.length; si++) {
    const cards = sections[si]?.cards ?? []
    for (let ci = 0; ci < cards.length; ci++) {
      const card = cards[ci]
      if (!card) continue
      if (cardIdentity(card, `card-${si}-${ci}`) === cardId) {
        return ['sections', si, 'cards', ci, 'comment']
      }
      const subs = card.subCards || []
      for (let sub = 0; sub < subs.length; sub++) {
        const child = subs[sub]
        if (!child) continue
        const subId = cardIdentity(child, `${cardIdentity(card, `card-${si}-${ci}`)}-${sub}`)
        if (subId === cardId) return ['sections', si, 'cards', ci, 'subCards', sub, 'comment']
      }
    }
  }
  return null
}
