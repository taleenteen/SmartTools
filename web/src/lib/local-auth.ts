const LS_USER = 'bm_cfg_user'
const LS_PASS = 'bm_cfg_pass'
const LS_SESS = 'bm_cfg_sess'
const LS_MODE = 'bm_cfg_mode'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  localStorage.setItem(key, value)
}

function remove(key: string) {
  localStorage.removeItem(key)
}

async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(bytes))
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('')
}

export function readSavedMode(): 'online' | 'local' | null {
  const value = read(LS_MODE)
  return value === 'local' || value === 'online' ? value : null
}

export function writeSavedMode(mode: 'online' | 'local') {
  write(LS_MODE, mode)
}

export function clearSavedMode() {
  remove(LS_MODE)
}

export function hasLocalCreds(): boolean {
  return !!read(LS_USER) && !!read(LS_PASS)
}

export async function registerLocal(username: string, password: string) {
  write(LS_USER, await sha256(username.trim()))
  write(LS_PASS, await sha256(password))
  write(LS_SESS, '1')
  try {
    sessionStorage.setItem('bm_cfg_local_name', username.trim())
  } catch {
    /* private mode */
  }
}

export async function loginLocal(username: string, password: string): Promise<boolean> {
  const userOk = (await sha256(username.trim())) === read(LS_USER)
  const passOk = (await sha256(password)) === read(LS_PASS)
  if (!userOk || !passOk) return false
  write(LS_SESS, '1')
  try {
    sessionStorage.setItem('bm_cfg_local_name', username.trim())
  } catch {
    /* private mode */
  }
  return true
}

export function localDisplayName(): string {
  try {
    return sessionStorage.getItem('bm_cfg_local_name') || 'local'
  } catch {
    return 'local'
  }
}

export async function changeLocalPassword(oldPassword: string, newPassword: string): Promise<boolean> {
  if ((await sha256(oldPassword)) !== read(LS_PASS)) return false
  write(LS_PASS, await sha256(newPassword))
  return true
}

export function resetLocalCreds() {
  remove(LS_USER)
  remove(LS_PASS)
  remove(LS_SESS)
}

export function hasLocalSession(): boolean {
  return read(LS_SESS) === '1' && hasLocalCreds()
}

export function clearLocalSession() {
  remove(LS_SESS)
}
