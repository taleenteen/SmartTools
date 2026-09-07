import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import {
  clearSessionPassword,
  decryptEnc,
  readSessionPassword,
  writeSessionPassword,
} from '@/lib/crypto-sections'
import { useBookmarksStore } from '@/stores/bookmarks'
import { useEditorStore } from '@/stores/editor'

export const useEncryptStore = defineStore('encrypt', () => {
  const unlockedKeys = ref<string[]>([])
  const dialogOpen = ref(false)
  const busy = ref(false)
  const error = ref('')
  const hasPassword = ref(!!readSessionPassword())
  const unlocked = computed(() => unlockedKeys.value.length > 0 || hasPassword.value)

  async function unlock(password: string): Promise<boolean> {
    const bookmarks = useBookmarksStore()
    const targets = bookmarks.sections.filter((section) => section.encrypted && section.enc)
    busy.value = true
    error.value = ''
    try {
      if (!targets.length) {
        writeSessionPassword(password)
        hasPassword.value = true
        return true
      }
      let any = false
      const nextKeys = [...unlockedKeys.value]
      for (const section of targets) {
        if (!section.enc) continue
        try {
          const raw = await decryptEnc(password, section.enc)
          const cards = bookmarks.hydrateCards(raw)
          bookmarks.replaceCards(section.key, cards)
          useEditorStore().applyDecrypted(section.key, cards)
          if (!nextKeys.includes(section.key)) nextKeys.push(section.key)
          any = true
        } catch {
          /* wrong password for this envelope */
        }
      }
      if (!any) {
        error.value = 'wrong'
        return false
      }
      writeSessionPassword(password)
      hasPassword.value = true
      unlockedKeys.value = nextKeys
      return true
    } finally {
      busy.value = false
    }
  }

  async function bootstrap() {
    const password = readSessionPassword()
    if (!password) return
    await unlock(password)
  }

  function lock() {
    clearSessionPassword()
    hasPassword.value = false
    unlockedKeys.value = []
    useBookmarksStore().clearDecrypted()
  }

  function openDialog() {
    dialogOpen.value = true
    error.value = ''
  }

  function closeDialog() {
    dialogOpen.value = false
    error.value = ''
  }

  function replaceSessionPassword(password: string) {
    if (!hasPassword.value) return
    writeSessionPassword(password)
  }

  return {
    unlockedKeys,
    dialogOpen,
    busy,
    error,
    hasPassword,
    unlocked,
    unlock,
    bootstrap,
    lock,
    openDialog,
    closeDialog,
    replaceSessionPassword,
  }
})
