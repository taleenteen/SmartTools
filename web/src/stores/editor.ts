import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { EncryptedSaveError, prepareSectionsForSave, serializeDataJs } from '@/lib/serialize-data-js'
import { storageLoad, storageSave } from '@/lib/storage'
import { t } from '@/i18n/th'
import type { BookmarkCard, BookmarkSection, DataMeta } from '@/types/bookmark'

export const UNCLASSIFIED_KEY = 'custom_unclassified'

function cloneSections(sections: BookmarkSection[]): BookmarkSection[] {
  return structuredClone(sections)
}

function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`
}

export const useEditorStore = defineStore('editor', () => {
  const sections = ref<BookmarkSection[]>([])
  const meta = ref<DataMeta | null>(null)
  const dirty = ref(false)
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const saving = ref(false)
  const error = ref('')
  const activeKey = ref('')
  const saveMessage = ref('')

  const activeSection = computed(
    () => sections.value.find((section) => section.key === activeKey.value) ?? sections.value[0] ?? null,
  )

  function markDirty() {
    dirty.value = true
    saveMessage.value = ''
  }

  async function load() {
    status.value = 'loading'
    error.value = ''
    try {
      const payload = await storageLoad()
      sections.value = cloneSections(payload.sections)
      meta.value = payload.meta
      activeKey.value = sections.value[0]?.key ?? ''
      dirty.value = false
      status.value = 'ready'
    } catch {
      status.value = 'error'
      error.value = t.loadErrorBody
    }
  }

  function setActive(key: string) {
    activeKey.value = key
  }

  function patchActive(partial: Partial<BookmarkSection>) {
    sections.value = sections.value.map((section) =>
      section.key === activeKey.value ? { ...section, ...partial } : section,
    )
    markDirty()
  }

  function mapActive(mutate: (section: BookmarkSection) => BookmarkSection) {
    sections.value = sections.value.map((section) =>
      section.key === activeKey.value ? mutate(section) : section,
    )
    markDirty()
  }

  function addCard(card: BookmarkCard) {
    mapActive((section) => ({
      ...section,
      cards: [...section.cards, { ...card, id: card.id || newId('card') }],
    }))
  }

  function appendCards(key: string, cards: BookmarkCard[]) {
    sections.value = sections.value.map((section) =>
      section.key === key
        ? { ...section, cards: [...section.cards, ...cards.map((card) => ({ ...card, id: card.id || newId('card') }))] }
        : section,
    )
    markDirty()
  }

  function moveCardToSection(index: number, targetKey: string, copy: boolean) {
    const source = activeSection.value
    if (!source) return
    const card = source.cards[index]
    if (!card) return
    const moving = copy ? structuredClone(card) : card
    if (copy) moving.id = newId('card')
    appendCards(targetKey, [moving])
    if (!copy) removeCard(index)
  }

  function updateCard(index: number, card: BookmarkCard) {
    mapActive((section) => ({
      ...section,
      cards: section.cards.map((item, i) => (i === index ? card : item)),
    }))
  }

  function removeCard(index: number) {
    mapActive((section) => ({
      ...section,
      cards: section.cards.filter((_, i) => i !== index),
    }))
  }

  function moveCard(index: number, delta: number) {
    const section = activeSection.value
    if (!section) return
    const next = index + delta
    if (next < 0 || next >= section.cards.length) return
    mapActive((current) => {
      const copy = [...current.cards]
      const a = copy[index]
      const b = copy[next]
      if (!a || !b) return current
      copy[index] = b
      copy[next] = a
      return { ...current, cards: copy }
    })
  }

  function applyDecrypted(key: string, cards: BookmarkCard[]) {
    sections.value = sections.value.map((section) => (section.key === key ? { ...section, cards } : section))
  }

  function replaceAll(next: BookmarkSection[]) {
    sections.value = next
    activeKey.value = next[0]?.key ?? ''
    markDirty()
  }

  function addSection(label: string, encrypted: boolean) {
    const key = `custom_${Math.random().toString(36).slice(2, 10)}`
    sections.value = [
      ...sections.value,
      {
        key,
        kind: 'card',
        label,
        builtin: false,
        visible: true,
        dynamic: false,
        encrypted,
        cards: [],
      },
    ]
    activeKey.value = key
    markDirty()
  }

  function deleteActiveSection() {
    const section = activeSection.value
    if (!section || section.builtin) return
    const moving = section.cards
    sections.value = sections.value.filter((item) => item.key !== section.key)
    if (moving.length) {
      let dump = sections.value.find((item) => item.key === UNCLASSIFIED_KEY)
      if (!dump) {
        dump = {
          key: UNCLASSIFIED_KEY,
          kind: 'card',
          label: t.unclassified,
          builtin: false,
          visible: true,
          dynamic: false,
          cards: [],
        }
        sections.value.push(dump)
      }
      dump.cards = [...dump.cards, ...moving]
    }
    activeKey.value = sections.value[0]?.key ?? ''
    markDirty()
  }

  async function save() {
    saving.value = true
    error.value = ''
    saveMessage.value = ''
    try {
      const prepared = await prepareSectionsForSave(cloneSections(sections.value))
      const packed = serializeDataJs(prepared, meta.value)
      await storageSave(packed.text)
      meta.value = packed.meta
      dirty.value = false
      saveMessage.value = t.saveOk
    } catch (err) {
      if (err instanceof EncryptedSaveError) {
        error.value = t.saveNeedUnlock
      } else {
        error.value = t.saveFailed
      }
      throw err
    } finally {
      saving.value = false
    }
  }

  return {
    sections,
    meta,
    dirty,
    status,
    saving,
    error,
    activeKey,
    activeSection,
    saveMessage,
    load,
    setActive,
    patchActive,
    addCard,
    appendCards,
    updateCard,
    removeCard,
    moveCard,
    moveCardToSection,
    addSection,
    deleteActiveSection,
    applyDecrypted,
    replaceAll,
    save,
  }
})
