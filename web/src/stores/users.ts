import { ref } from 'vue'
import { defineStore } from 'pinia'

import {
  archiveTs,
  archiveUser,
  cleanupArchivedUser,
  deleteArchive,
  deleteUser,
  getArchiveFull,
  listArchives,
  listUsers,
  saveUser,
  type ArchiveRow,
  type UserRow,
} from '@/lib/api'

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export const useUsersStore = defineStore('users', () => {
  const items = ref<UserRow[]>([])
  const archives = ref<ArchiveRow[]>([])
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const archivesStatus = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const error = ref('')

  async function refresh() {
    status.value = 'loading'
    error.value = ''
    try {
      items.value = await listUsers()
      status.value = 'ready'
    } catch {
      error.value = 'users-list-failed'
      status.value = 'error'
    }
  }

  async function refreshArchives() {
    archivesStatus.value = 'loading'
    error.value = ''
    try {
      archives.value = await listArchives()
      archivesStatus.value = 'ready'
    } catch {
      error.value = 'archives-list-failed'
      archivesStatus.value = 'error'
    }
  }

  async function createOrReset(username: string, password: string) {
    await saveUser(username, password)
    await refresh()
  }

  async function remove(username: string) {
    await deleteUser(username)
    await refresh()
  }

  async function archiveOnly(username: string) {
    const archiveKey = await archiveUser(username)
    await refreshArchives()
    return archiveKey
  }

  async function cleanup(username: string, archiveKey: string) {
    await cleanupArchivedUser(username, archiveKey)
    await refresh()
    await refreshArchives()
  }

  async function downloadArchive(row: ArchiveRow) {
    await downloadArchiveByKey(row.archiveKey, row.username || 'user', row.archivedAtLocal)
  }

  async function downloadArchiveByKey(archiveKey: string, username: string, stamp?: string | null) {
    const payload = await getArchiveFull(archiveKey)
    downloadJson(`${username}-${stamp || archiveTs(archiveKey) || 'archive'}-archive.json`, payload)
  }

  async function removeArchive(archiveKey: string, ts: string) {
    await deleteArchive(archiveKey, ts)
    await refreshArchives()
  }

  return {
    items,
    archives,
    status,
    archivesStatus,
    error,
    refresh,
    refreshArchives,
    createOrReset,
    remove,
    archiveOnly,
    cleanup,
    downloadArchive,
    downloadArchiveByKey,
    removeArchive,
  }
})
