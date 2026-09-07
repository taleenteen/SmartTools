import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { clearSavedMode, readSavedMode, writeSavedMode } from '@/lib/local-auth'
import { localFs } from '@/lib/local-fs'

export const useModeStore = defineStore('mode', () => {
  const kind = ref<'online' | 'local'>(readSavedMode() || 'online')
  const folderReady = ref(false)
  const supported = computed(() => localFs.supported())

  function setKind(next: 'online' | 'local') {
    kind.value = next
    writeSavedMode(next)
  }

  async function connectFolder() {
    const ok = await localFs.pick()
    folderReady.value = ok && !!(await localFs.ensurePermission())
    return folderReady.value
  }

  async function restoreFolder() {
    const ok = await localFs.restore()
    folderReady.value = ok
    if (ok && localFs.folder && (await localFs.ensurePermission())) folderReady.value = true
    return folderReady.value
  }

  function reset() {
    kind.value = 'online'
    folderReady.value = false
    clearSavedMode()
  }

  return { kind, folderReady, supported, setKind, connectFolder, restoreFolder, reset }
})
