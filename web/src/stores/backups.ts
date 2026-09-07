import { ref } from 'vue'
import { defineStore } from 'pinia'

import type { BackupItem } from '@/lib/api'
import {
  storageDeleteBackup,
  storageGetBackup,
  storageListBackups,
  storageRestoreBackup,
} from '@/lib/storage'

export const useBackupsStore = defineStore('backups', () => {
  const items = ref<BackupItem[]>([])
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const error = ref('')
  const preview = ref('')
  const previewName = ref('')

  async function refresh() {
    status.value = 'loading'
    error.value = ''
    try {
      items.value = await storageListBackups()
      status.value = 'ready'
    } catch {
      error.value = 'backup-list-failed'
      status.value = 'error'
    }
  }

  async function readContent(name: string) {
    return storageGetBackup(name)
  }

  async function download(name: string) {
    const content = await readContent(name)
    const blob = new Blob([content], { type: 'text/javascript;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${name}.js`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function previewBackup(name: string) {
    previewName.value = name
    preview.value = await readContent(name)
  }

  async function restore(name: string) {
    await storageRestoreBackup(name)
    await refresh()
  }

  async function remove(name: string) {
    await storageDeleteBackup(name)
    await refresh()
  }

  return { items, status, error, preview, previewName, refresh, download, previewBackup, restore, remove }
})
