import {
  deleteBackup,
  getBackup,
  listBackups,
  restoreBackup,
  saveData,
  type BackupItem,
} from '@/lib/api'
import { loadBookmarkData, type LoadedBookmarkPayload } from '@/lib/data-client'
import { localFs } from '@/lib/local-fs'
import { parseDataJs } from '@/lib/parse-data-js'
import { useModeStore } from '@/stores/mode'

async function folderReady(): Promise<boolean> {
  const mode = useModeStore()
  if (mode.kind !== 'local') return false
  if (mode.folderReady) return true
  return mode.restoreFolder()
}

/** Public slug views always hit KV. Local folder is only for the owner's unscoped load. */
export async function storageLoad(slug?: string): Promise<LoadedBookmarkPayload> {
  if (!slug && (await folderReady())) {
    const text = await localFs.readDataJs()
    if (!text) throw new Error('no-folder-data')
    return {
      ...parseDataJs(text),
      source: 'folder',
      viewer: { isAdminView: true },
    }
  }
  return loadBookmarkData(slug)
}

export async function storageSave(content: string): Promise<void> {
  if (await folderReady()) {
    await localFs.writeDataJs(content)
    return
  }
  await saveData(content)
}

export async function storageListBackups(): Promise<BackupItem[]> {
  if (await folderReady()) {
    return (await localFs.listBackups()).map((row) => ({ name: row.name }))
  }
  return listBackups()
}

export async function storageGetBackup(name: string): Promise<string> {
  if (await folderReady()) return localFs.readBackup(name)
  return getBackup(name)
}

export async function storageRestoreBackup(name: string): Promise<void> {
  if (await folderReady()) {
    await localFs.writeDataJs(await localFs.readBackup(name))
    return
  }
  await restoreBackup(name)
}

export async function storageDeleteBackup(name: string): Promise<void> {
  if (await folderReady()) {
    await localFs.deleteBackup(name)
    return
  }
  await deleteBackup(name)
}
