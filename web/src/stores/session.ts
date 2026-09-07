import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { checkSession, login as apiLogin, logout as apiLogout } from '@/lib/api'
import { t } from '@/i18n/th'
import { hasLocalSession, localDisplayName } from '@/lib/local-auth'
import { useModeStore } from '@/stores/mode'

export const useSessionStore = defineStore('session', () => {
  const username = ref<string | null>(null)
  const role = ref<string | null>(null)
  const uid = ref<string | null>(null)
  const hasKV = ref(false)
  const publicSlug = ref<string | null>(null)
  const publicEnabled = ref(false)
  const inboxPolicy = ref<'open' | 'closed'>('open')
  const migrationNeeded = ref(false)
  const status = ref<'idle' | 'checking' | 'ready'>('idle')
  const error = ref('')

  const loggedIn = computed(() => !!username.value)

  async function check() {
    status.value = 'checking'
    error.value = ''
    const mode = useModeStore()
    if (mode.kind === 'local') {
      if (hasLocalSession()) adoptLocal(localDisplayName())
      else {
        username.value = null
        status.value = 'ready'
      }
      return
    }
    try {
      const snap = await checkSession()
      username.value = snap.loggedIn ? snap.username : null
      role.value = snap.loggedIn ? snap.role : null
      uid.value = snap.loggedIn ? snap.uid : null
      hasKV.value = !!snap.hasKV
      publicSlug.value = snap.loggedIn ? snap.publicSlug : null
      publicEnabled.value = snap.loggedIn ? snap.publicEnabled : false
      inboxPolicy.value = snap.loggedIn ? snap.inboxPolicy : 'open'
      migrationNeeded.value = snap.loggedIn ? snap.migrationNeeded : false
    } catch {
      username.value = null
      role.value = null
      uid.value = null
      publicSlug.value = null
      publicEnabled.value = false
      inboxPolicy.value = 'open'
      migrationNeeded.value = false
    } finally {
      status.value = 'ready'
    }
  }

  async function login(user: string, password: string) {
    error.value = ''
    if (!user.trim() || !password) {
      error.value = t.loginNeedFields
      return false
    }
    try {
      await apiLogin(user.trim(), password)
      await check()
      return loggedIn.value
    } catch (err) {
      error.value = err instanceof Error ? t.loginFailed : t.loginFailed
      username.value = null
      return false
    }
  }

  function adoptLocal(name: string) {
    username.value = name
    role.value = 'admin'
    uid.value = name
    hasKV.value = false
    publicSlug.value = null
    publicEnabled.value = false
    inboxPolicy.value = 'open'
    migrationNeeded.value = false
    status.value = 'ready'
    error.value = ''
  }

  async function logout() {
    try {
      if (useModeStore().kind !== 'local') await apiLogout()
    } finally {
      useModeStore().reset()
      try {
        sessionStorage.removeItem('bm_cfg_local_name')
      } catch {
        /* ignore */
      }
      username.value = null
      role.value = null
      uid.value = null
      publicSlug.value = null
      publicEnabled.value = false
      inboxPolicy.value = 'open'
      migrationNeeded.value = false
    }
  }

  return {
    username,
    role,
    uid,
    hasKV,
    publicSlug,
    publicEnabled,
    inboxPolicy,
    migrationNeeded,
    status,
    error,
    loggedIn,
    check,
    login,
    adoptLocal,
    logout,
  }
})
