const IDB_NAME = 'bm_cfg_db'
const IDB_STORE = 'handles'
const MAX_BACKUPS_LOCAL = 100

export interface LocalBackup {
  name: string
  size: number
  modified: number
}

function fsaSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'
}

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(IDB_STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function idbSet(key: string, value: FileSystemDirectoryHandle) {
  const db = await idbOpen()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function idbGet(key: string): Promise<FileSystemDirectoryHandle | undefined> {
  const db = await idbOpen()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly')
    const request = tx.objectStore(IDB_STORE).get(key)
    request.onsuccess = () => resolve(request.result as FileSystemDirectoryHandle | undefined)
    request.onerror = () => reject(request.error)
  })
}

function timestamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

async function verifyPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const opts = { mode: 'readwrite' as const }
  if ((await handle.queryPermission(opts)) === 'granted') return true
  return (await handle.requestPermission(opts)) === 'granted'
}

async function writeFile(dir: FileSystemDirectoryHandle, name: string, content: string) {
  const file = await dir.getFileHandle(name, { create: true })
  const writable = await file.createWritable()
  await writable.write(content)
  await writable.close()
}

async function pruneBackups(bakDir: FileSystemDirectoryHandle): Promise<number> {
  const items: { name: string; modified: number }[] = []
  for await (const entry of bakDir.values()) {
    if (entry.kind === 'file' && /\.js$/i.test(entry.name)) {
      const file = await (entry as FileSystemFileHandle).getFile()
      items.push({ name: entry.name, modified: file.lastModified })
    }
  }
  if (items.length <= MAX_BACKUPS_LOCAL) return 0
  items.sort((a, b) => b.modified - a.modified)
  const extra = items.slice(MAX_BACKUPS_LOCAL)
  for (const item of extra) await bakDir.removeEntry(item.name)
  return extra.length
}

export const localFs = {
  supported: fsaSupported,
  folder: null as FileSystemDirectoryHandle | null,

  async pick(): Promise<boolean> {
    if (!fsaSupported()) return false
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
      this.folder = handle
      await idbSet('folderHandle', handle)
      return true
    } catch {
      return false
    }
  },

  async restore(): Promise<boolean> {
    if (!fsaSupported()) return false
    try {
      const handle = await idbGet('folderHandle')
      if (!handle) return false
      if ((await handle.queryPermission({ mode: 'readwrite' })) !== 'granted') {
        this.folder = handle
        return false
      }
      this.folder = handle
      return true
    } catch {
      return false
    }
  },

  async ensurePermission(): Promise<boolean> {
    if (!this.folder) return false
    return verifyPermission(this.folder)
  },

  async readDataJs(): Promise<string | null> {
    if (!this.folder) return null
    try {
      const fileHandle = await this.folder.getFileHandle('data.js')
      const file = await fileHandle.getFile()
      return file.text()
    } catch {
      return null
    }
  },

  async writeDataJs(content: string): Promise<void> {
    if (!this.folder) throw new Error('no-folder')
    if (!(await verifyPermission(this.folder))) throw new Error('no-permission')
    let oldText = ''
    try {
      const oldHandle = await this.folder.getFileHandle('data.js')
      oldText = await (await oldHandle.getFile()).text()
    } catch {
      oldText = ''
    }
    if (oldText.trim() && oldText !== content) {
      const bakDir = await this.folder.getDirectoryHandle('databak', { create: true })
      await writeFile(bakDir, `data_${timestamp()}.js`, oldText)
      await pruneBackups(bakDir)
    }
    await writeFile(this.folder, 'data.js', content)
  },

  async listBackups(): Promise<LocalBackup[]> {
    if (!this.folder) return []
    try {
      const bakDir = await this.folder.getDirectoryHandle('databak', { create: true })
      const items: LocalBackup[] = []
      for await (const entry of bakDir.values()) {
        if (entry.kind !== 'file' || !/\.js$/i.test(entry.name)) continue
        const file = await (entry as FileSystemFileHandle).getFile()
        items.push({ name: entry.name, size: file.size, modified: file.lastModified })
      }
      return items.sort((a, b) => b.modified - a.modified)
    } catch {
      return []
    }
  },

  async readBackup(name: string): Promise<string> {
    if (!this.folder) throw new Error('no-folder')
    const bakDir = await this.folder.getDirectoryHandle('databak')
    const fileHandle = await bakDir.getFileHandle(name)
    return (await fileHandle.getFile()).text()
  },

  async deleteBackup(name: string) {
    if (!this.folder) throw new Error('no-folder')
    const bakDir = await this.folder.getDirectoryHandle('databak')
    await bakDir.removeEntry(name)
  },
}
