import type { EncEnvelope } from '@/types/bookmark'

function b64e(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i] ?? 0)
  return btoa(s)
}

function b64d(s: string): Uint8Array {
  const binary = atob(s)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function deriveKey(password: string, salt: Uint8Array, iter: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: iter, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptJSON(password: string, value: unknown): Promise<EncEnvelope> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const iter = 300000
  const key = await deriveKey(password, salt, iter)
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(JSON.stringify(value)),
  )
  return {
    v: 1,
    alg: 'AES-GCM-256/PBKDF2-SHA256',
    iter,
    salt: b64e(salt),
    iv: b64e(iv),
    data: b64e(new Uint8Array(cipher)),
  }
}

export async function decryptEnc(password: string, enc: EncEnvelope): Promise<unknown> {
  if (!enc.salt || !enc.iv || !enc.data) throw new Error('invalid envelope')
  const key = await deriveKey(password, b64d(enc.salt), enc.iter || 300000)
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64d(enc.iv) as BufferSource },
    key,
    b64d(enc.data) as BufferSource,
  )
  return JSON.parse(new TextDecoder().decode(plain))
}

export const ENC_PASSWORD_KEY = 'bm_cfg_enc_pwd'
export const ENC_REVEAL_KEY = 'bm_cfg_enc_reveal'

export function readSessionPassword(): string | null {
  try {
    return sessionStorage.getItem(ENC_PASSWORD_KEY)
  } catch {
    return null
  }
}

export function writeSessionPassword(password: string) {
  try {
    sessionStorage.setItem(ENC_PASSWORD_KEY, password)
  } catch {
    /* private mode */
  }
}

export function clearSessionPassword() {
  try {
    sessionStorage.removeItem(ENC_PASSWORD_KEY)
    sessionStorage.removeItem(ENC_REVEAL_KEY)
  } catch {
    /* ignore */
  }
}
