import type { BookmarkCard } from '@/types/bookmark'

export class ApiError extends Error {
  status: number
  code: string | null
  conflict: boolean
  requiresForce: boolean
  constructor(
    message: string,
    status: number,
    extra?: { code?: string; conflict?: boolean; requiresForce?: boolean },
  ) {
    super(message)
    this.status = status
    this.code = extra?.code ?? null
    this.conflict = extra?.conflict === true
    this.requiresForce = extra?.requiresForce === true
  }
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>
  } catch {
    return {}
  }
}

async function request(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  const body = await readJson(response)
  if (!response.ok || body.ok === false) {
    const message = typeof body.error === 'string' ? body.error : `HTTP ${response.status}`
    throw new ApiError(message, response.status, {
      code: typeof body.code === 'string' ? body.code : undefined,
      conflict: body.conflict === true,
      requiresForce: body.requiresForce === true,
    })
  }
  return body
}

export interface SessionSnapshot {
  loggedIn: boolean
  username: string | null
  uid: string | null
  role: string | null
  hasKV: boolean
  hasAdmin: boolean
  publicSlug: string | null
  publicEnabled: boolean
  inboxPolicy: 'open' | 'closed'
  migrationNeeded: boolean
}

export async function checkSession(): Promise<SessionSnapshot> {
  const body = await request('/api/check')
  return {
    loggedIn: body.loggedIn === true,
    username: typeof body.username === 'string' ? body.username : null,
    uid: typeof body.uid === 'string' ? body.uid : null,
    role: typeof body.role === 'string' ? body.role : null,
    hasKV: body.hasKV === true,
    hasAdmin: body.hasAdmin === true,
    publicSlug: typeof body.publicSlug === 'string' && body.publicSlug ? body.publicSlug : null,
    publicEnabled: body.publicEnabled === true,
    inboxPolicy: body.inboxPolicy === 'closed' ? 'closed' : 'open',
    migrationNeeded: body.migrationNeeded === true,
  }
}

export function login(username: string, password: string) {
  return request('/api/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function logout() {
  return request('/api/logout', { method: 'POST' })
}

export function saveData(content: string) {
  return request('/api/save', {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
}

export async function getSource(): Promise<'kv' | 'static'> {
  const body = await request('/api/source')
  return body.source === 'kv' ? 'kv' : 'static'
}

export function setSource(source: 'kv' | 'static') {
  return request('/api/source', {
    method: 'POST',
    body: JSON.stringify({ source }),
  })
}

export interface BackupItem {
  name: string
  legacy?: boolean
}

export async function listBackups(): Promise<BackupItem[]> {
  const body = await request('/api/backups')
  return Array.isArray(body.backups) ? (body.backups as BackupItem[]) : []
}

export async function getBackup(name: string): Promise<string> {
  const body = await request(`/api/backups?name=${encodeURIComponent(name)}`)
  return typeof body.content === 'string' ? body.content : ''
}

export function restoreBackup(name: string) {
  return request(`/api/backups?name=${encodeURIComponent(name)}&action=restore`, { method: 'POST' })
}

export function deleteBackup(name: string) {
  return request(`/api/backups?name=${encodeURIComponent(name)}`, { method: 'DELETE' })
}

export function changePassword(oldPassword: string, newPassword: string) {
  return request('/api/change-password', {
    method: 'POST',
    body: JSON.stringify({ oldPassword, newPassword }),
  })
}

export interface PublicSlugState {
  username: string
  slug: string
  enabled: boolean
}

export async function getPublicSlug(username: string): Promise<PublicSlugState> {
  const body = await request(`/api/public-slug?u=${encodeURIComponent(username)}`)
  return {
    username: typeof body.username === 'string' ? body.username : username,
    slug: typeof body.slug === 'string' ? body.slug : '',
    enabled: body.enabled === true,
  }
}

export function setPublicSlug(username: string, slug: string, enabled: boolean) {
  return request('/api/public-slug', {
    method: 'POST',
    body: JSON.stringify({ username, slug, enabled }),
  })
}

export function disablePublicSlug(username: string) {
  return request(`/api/public-slug?u=${encodeURIComponent(username)}`, { method: 'DELETE' })
}

export interface UserRow {
  username: string
  role: string
  status: string
  hasData: boolean
  algo: 'pbkdf2' | 'sha256'
  createdAt: string | null
  publicSlug: string
  publicEnabled: boolean
}

function asUserRow(value: unknown): UserRow | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (typeof row.username !== 'string') return null
  return {
    username: row.username,
    role: typeof row.role === 'string' ? row.role : 'user',
    status: typeof row.status === 'string' ? row.status : 'active',
    hasData: row.hasData === true,
    algo: row.algo === 'pbkdf2' ? 'pbkdf2' : 'sha256',
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : null,
    publicSlug: typeof row.publicSlug === 'string' ? row.publicSlug : '',
    publicEnabled: row.publicEnabled === true,
  }
}

export async function listUsers(): Promise<UserRow[]> {
  const body = await request('/api/users')
  if (!Array.isArray(body.users)) return []
  return body.users.map(asUserRow).filter((row): row is UserRow => row !== null)
}

export function saveUser(username: string, password: string) {
  return request('/api/users', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function deleteUser(username: string) {
  return request(`/api/users?u=${encodeURIComponent(username)}`, { method: 'DELETE' })
}

export async function archiveUser(username: string): Promise<string> {
  const body = await request(
    `/api/users?u=${encodeURIComponent(username)}&force=1&confirm=${encodeURIComponent(`DELETE-${username}`)}&action=archive-only`,
    { method: 'DELETE' },
  )
  return typeof body.archiveKey === 'string' ? body.archiveKey : ''
}

export function cleanupArchivedUser(username: string, archiveKey: string) {
  return request(
    `/api/users?action=cleanup-after-archive&u=${encodeURIComponent(username)}&archiveKey=${encodeURIComponent(archiveKey)}`,
    { method: 'POST' },
  )
}

export interface ArchiveRow {
  archiveKey: string
  username: string | null
  archivedAtLocal: string | null
  archivedBy: string | null
  dataSize: number
  backupCount: number
}

function asArchiveRow(value: unknown): ArchiveRow | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (typeof row.archiveKey !== 'string') return null
  return {
    archiveKey: row.archiveKey,
    username: typeof row.username === 'string' ? row.username : null,
    archivedAtLocal: typeof row.archivedAtLocal === 'string' ? row.archivedAtLocal : null,
    archivedBy: typeof row.archivedBy === 'string' ? row.archivedBy : null,
    dataSize: typeof row.dataSize === 'number' ? row.dataSize : 0,
    backupCount: typeof row.backupCount === 'number' ? row.backupCount : 0,
  }
}

export async function listArchives(): Promise<ArchiveRow[]> {
  const body = await request('/api/archives')
  if (!Array.isArray(body.archives)) return []
  return body.archives.map(asArchiveRow).filter((row): row is ArchiveRow => row !== null)
}

export async function getArchiveFull(archiveKey: string): Promise<Record<string, unknown>> {
  return request(`/api/archives?key=${encodeURIComponent(archiveKey)}&include=full`)
}

export function deleteArchive(archiveKey: string, ts: string) {
  return request(
    `/api/archives?key=${encodeURIComponent(archiveKey)}&confirm=${encodeURIComponent(`DELETE-ARCHIVE-${ts}`)}`,
    { method: 'DELETE' },
  )
}

export function archiveTs(archiveKey: string): string {
  const parts = archiveKey.split(':')
  return parts[2] ?? ''
}

export type InboxStatus = 'pending' | 'accepted' | 'rejected'

export interface InboxMessage {
  msgId: string
  fromUsername: string
  toUsername?: string
  sentAt: string
  section_key: string
  cards: BookmarkCard[]
  message: string
  status: InboxStatus
  fromEncrypted: boolean
}

function asInboxMessage(value: unknown): InboxMessage | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (typeof row.msgId !== 'string') return null
  const status: InboxStatus =
    row.status === 'accepted' || row.status === 'rejected' ? row.status : 'pending'
  return {
    msgId: row.msgId,
    fromUsername: typeof row.fromUsername === 'string' ? row.fromUsername : '',
    toUsername: typeof row.toUsername === 'string' ? row.toUsername : undefined,
    sentAt: typeof row.sentAt === 'string' ? row.sentAt : '',
    section_key: typeof row.section_key === 'string' ? row.section_key : 'custom_unclassified',
    cards: Array.isArray(row.cards) ? (row.cards as BookmarkCard[]) : [],
    message: typeof row.message === 'string' ? row.message : '',
    status,
    fromEncrypted: row.fromEncrypted === true,
  }
}

export async function listInbox(kind: 'received' | 'sent' = 'received', status?: InboxStatus | '') {
  const query = new URLSearchParams()
  if (kind === 'sent') query.set('type', 'sent')
  if (status) query.set('status', status)
  const suffix = query.toString() ? `?${query.toString()}` : ''
  const body = await request(`/api/inbox${suffix}`)
  const messages = Array.isArray(body.messages)
    ? body.messages.map(asInboxMessage).filter((row): row is InboxMessage => row !== null)
    : []
  return {
    messages,
    unreadCount: typeof body.unreadCount === 'number' ? body.unreadCount : 0,
  }
}

export function inboxAction(action: string, body: Record<string, unknown>) {
  return request(`/api/inbox?action=${encodeURIComponent(action)}`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function sendInbox(toUsername: string, cards: BookmarkCard[], message: string, sectionKey: string) {
  return request('/api/inbox?action=send', {
    method: 'POST',
    body: JSON.stringify({ toUsername, cards, message, section_key: sectionKey }),
  })
}

export function setInboxPolicy(policy: 'open' | 'closed') {
  return request('/api/inbox?action=set-policy', {
    method: 'POST',
    body: JSON.stringify({ policy }),
  })
}

export function pushCards(payload: {
  target_users: string[]
  section_key: string
  cards: BookmarkCard[]
  message: string
  mode: 'append' | 'force'
}) {
  return request('/api/push', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function patchComment(path: (string | number)[], comment: string) {
  return request('/api/comment', {
    method: 'POST',
    body: JSON.stringify({ path, comment }),
  })
}

export function migrateV2(dryRun: boolean) {
  return request('/api/migrate-v2', {
    method: 'POST',
    body: JSON.stringify({ dryRun }),
  })
}

export const PUBLIC_ACCEPT_KEYS = [
  'usbDriveData',
  'teachingData',
  'onlineAIData',
  'videoData',
  'emailData',
  'contactData',
  'custom_unclassified',
] as const
