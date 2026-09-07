import { ref } from 'vue'
import { defineStore } from 'pinia'

export interface NoteTarget {
  cardId: string
  card: { comment?: string }
  href?: string
  encrypted?: boolean
}

export const useUiStore = defineStore('ui', () => {
  const expandedCardId = ref<string | null>(null)
  const overlayOpen = ref(false)
  const note = ref<NoteTarget | null>(null)

  function toggleExpanded(cardId: string) {
    expandedCardId.value = expandedCardId.value === cardId ? null : cardId
    overlayOpen.value = expandedCardId.value !== null
  }

  function collapse() {
    expandedCardId.value = null
    overlayOpen.value = false
  }

  function openNote(target: NoteTarget) {
    note.value = target
  }

  function closeNote() {
    note.value = null
  }

  return { expandedCardId, overlayOpen, note, toggleExpanded, collapse, openNote, closeNote }
})
