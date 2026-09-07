<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { t } from '@/i18n/th'
import {
  ApiError,
  changePassword,
  disablePublicSlug,
  getPublicSlug,
  setPublicSlug,
} from '@/lib/api'
import { changeLocalPassword } from '@/lib/local-auth'
import { requiredUsernameSubstringLen, slugIssue, type SlugRole } from '@/lib/slug'
import { useEncryptStore } from '@/stores/encrypt'
import { useInboxStore } from '@/stores/inbox'
import { useModeStore } from '@/stores/mode'
import { useSessionStore } from '@/stores/session'

const session = useSessionStore()
const encrypt = useEncryptStore()
const inbox = useInboxStore()
const mode = useModeStore()
const policyMessage = ref('')

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const passwordBusy = ref(false)
const passwordMessage = ref('')
const passwordError = ref('')

const slug = ref('')
const enabled = ref(false)
const slugBusy = ref(false)
const slugMessage = ref('')
const slugError = ref('')
const slugUnavailable = ref(false)
const confirmDisable = ref(false)
const copied = ref<'at' | 'user' | ''>('')

const slugRole = computed<SlugRole>(() => (session.role === 'admin' ? 'admin' : 'user'))

const liveSlugError = computed(() => {
  if (slugUnavailable.value) return t.slugNeedUserRow
  const username = session.username
  if (!username) return t.slugNeedUserRow
  const issue = slugIssue(slug.value, slugRole.value, username)
  if (!issue) return ''
  if (issue === 'empty') return enabled.value ? t.slugNeedValue : ''
  if (issue === 'invalid') return t.slugInvalid
  if (issue === 'reserved') return t.slugReserved
  return t.slugNeedUsername(requiredUsernameSubstringLen(username))
})

const origin = typeof window !== 'undefined' ? window.location.origin : ''
const atUrl = computed(() => (slug.value ? `${origin}/@${slug.value.trim().toLowerCase()}` : ''))
const userUrl = computed(() => (slug.value ? `${origin}/u/${slug.value.trim().toLowerCase()}` : ''))

onMounted(() => {
  void loadSlug()
})

async function loadSlug() {
  const username = session.username
  if (!username) {
    slugUnavailable.value = true
    return
  }
  try {
    const state = await getPublicSlug(username)
    slug.value = state.slug
    enabled.value = state.enabled
    slugUnavailable.value = false
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      slugUnavailable.value = true
      return
    }
    slugError.value = t.saveFailed
  }
}

function passwordApiError(err: unknown): string {
  if (err instanceof ApiError && err.status === 401) return t.passwordWrong
  if (err instanceof ApiError && err.status === 400) return t.passwordEnvAdmin
  return t.saveFailed
}

function slugApiError(err: unknown): string {
  if (err instanceof ApiError && err.conflict) return t.slugTaken
  if (err instanceof ApiError && err.code === 'USERNAME_SUBSTRING_REQUIRED' && session.username) {
    return t.slugNeedUsername(requiredUsernameSubstringLen(session.username))
  }
  if (err instanceof ApiError && err.status === 404) return t.slugNeedUserRow
  return t.saveFailed
}

async function submitPassword() {
  passwordError.value = ''
  passwordMessage.value = ''
  if (newPassword.value.length < 4) {
    passwordError.value = t.passwordTooShort
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = t.passwordMismatch
    return
  }
  passwordBusy.value = true
  try {
    if (mode.kind === 'local') {
      const ok = await changeLocalPassword(currentPassword.value, newPassword.value)
      if (!ok) {
        passwordError.value = t.passwordWrong
        return
      }
    } else {
      await changePassword(currentPassword.value, newPassword.value)
    }
    encrypt.replaceSessionPassword(newPassword.value)
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    passwordMessage.value = t.passwordOk
  } catch (err) {
    passwordError.value = passwordApiError(err)
  } finally {
    passwordBusy.value = false
  }
}

async function submitSlug() {
  slugError.value = ''
  slugMessage.value = ''
  const username = session.username
  if (!username) {
    slugError.value = t.slugNeedUserRow
    return
  }
  if (liveSlugError.value) {
    slugError.value = liveSlugError.value
    return
  }
  slugBusy.value = true
  try {
    await setPublicSlug(username, slug.value.trim().toLowerCase(), enabled.value)
    await session.check()
    slugMessage.value = t.slugOk
  } catch (err) {
    slugError.value = slugApiError(err)
  } finally {
    slugBusy.value = false
  }
}

async function confirmDisableSlug() {
  const username = session.username
  confirmDisable.value = false
  if (!username) return
  slugBusy.value = true
  slugError.value = ''
  slugMessage.value = ''
  try {
    await disablePublicSlug(username)
    enabled.value = false
    await session.check()
    slugMessage.value = t.slugOk
  } catch (err) {
    slugError.value = slugApiError(err)
  } finally {
    slugBusy.value = false
  }
}

async function savePolicy(policy: 'open' | 'closed') {
  policyMessage.value = ''
  try {
    await inbox.setPolicy(policy)
    session.inboxPolicy = policy
    policyMessage.value = t.inboxPolicySaved
  } catch {
    policyMessage.value = t.saveFailed
  }
}

async function copyUrl(kind: 'at' | 'user') {
  const value = kind === 'at' ? atUrl.value : userUrl.value
  if (!value) return
  try {
    await navigator.clipboard.writeText(value)
    copied.value = kind
  } catch {
    copied.value = ''
  }
}
</script>

<template>
  <div class="space-y-4">
    <Card>
      <CardHeader>
        <CardTitle>{{ t.accountPasswordTitle }}</CardTitle>
        <CardDescription>{{ t.accountPasswordHint }}</CardDescription>
      </CardHeader>
      <CardContent>
        <form class="space-y-3" @submit.prevent="submitPassword">
          <label class="block text-sm font-medium">
            {{ t.passwordCurrent }}
            <Input v-model="currentPassword" class="mt-1" type="password" autocomplete="current-password" />
          </label>
          <label class="block text-sm font-medium">
            {{ t.passwordNew }}
            <Input v-model="newPassword" class="mt-1" type="password" autocomplete="new-password" />
          </label>
          <label class="block text-sm font-medium">
            {{ t.passwordConfirm }}
            <Input v-model="confirmPassword" class="mt-1" type="password" autocomplete="new-password" />
          </label>
          <p class="text-sm text-muted-foreground">{{ t.passwordNeedSave }}</p>
          <p v-if="passwordError" class="text-sm text-destructive">{{ passwordError }}</p>
          <p v-else-if="passwordMessage" class="text-sm text-primary">{{ passwordMessage }}</p>
          <Button size="sm" type="submit" :disabled="passwordBusy">{{ t.passwordSubmit }}</Button>
        </form>
      </CardContent>
    </Card>

    <Card v-if="mode.kind === 'online'">
      <CardHeader>
        <CardTitle>{{ t.accountSlugTitle }}</CardTitle>
        <CardDescription>{{ t.accountSlugHint }}</CardDescription>
      </CardHeader>
      <CardContent>
        <div v-if="slugUnavailable" class="text-sm text-muted-foreground">{{ t.slugNeedUserRow }}</div>
        <div v-else class="space-y-3">
          <p class="text-sm">
            <span class="text-muted-foreground">{{ t.username }}</span>
            <span class="ml-2 font-medium">{{ session.username }}</span>
          </p>
          <label class="flex items-center gap-2 text-sm">
            <input v-model="enabled" type="checkbox" />
            {{ t.slugEnabled }}
          </label>
          <p v-if="!enabled" class="text-sm text-muted-foreground">{{ t.slugDisabledHint }}</p>
          <label class="block text-sm font-medium">
            {{ t.slugField }}
            <Input v-model="slug" class="mt-1 font-mono" autocomplete="off" maxlength="32" />
          </label>
          <p v-if="liveSlugError" class="text-sm text-destructive">{{ liveSlugError }}</p>
          <div v-if="atUrl" class="space-y-2">
            <div class="flex flex-wrap items-center gap-2">
              <span class="w-16 text-xs text-muted-foreground">{{ t.slugUrlAt }}</span>
              <Input :model-value="atUrl" readonly class="min-w-0 flex-1 font-mono text-xs" />
              <Button size="sm" variant="outline" type="button" @click="copyUrl('at')">
                {{ copied === 'at' ? t.slugCopied : t.slugCopy }}
              </Button>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <span class="w-16 text-xs text-muted-foreground">{{ t.slugUrlUser }}</span>
              <Input :model-value="userUrl" readonly class="min-w-0 flex-1 font-mono text-xs" />
              <Button size="sm" variant="outline" type="button" @click="copyUrl('user')">
                {{ copied === 'user' ? t.slugCopied : t.slugCopy }}
              </Button>
            </div>
          </div>
          <p v-if="slugError" class="text-sm text-destructive">{{ slugError }}</p>
          <p v-else-if="slugMessage" class="text-sm text-primary">{{ slugMessage }}</p>
          <div class="flex flex-wrap gap-2">
            <Button size="sm" :disabled="slugBusy || !!liveSlugError" @click="submitSlug">
              {{ t.slugSave }}
            </Button>
            <Button size="sm" variant="outline" :disabled="slugBusy" @click="confirmDisable = true">
              {{ t.slugDisable }}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <Card v-if="mode.kind === 'online'">
      <CardHeader>
        <CardTitle>{{ t.inboxPolicyTitle }}</CardTitle>
        <CardDescription>{{ t.inboxPolicyOpen }}</CardDescription>
      </CardHeader>
      <CardContent class="space-y-2">
        <label class="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="inbox-policy"
            :checked="session.inboxPolicy === 'open'"
            @change="savePolicy('open')"
          />
          {{ t.inboxPolicyOpen }}
        </label>
        <label class="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="inbox-policy"
            :checked="session.inboxPolicy === 'closed'"
            @change="savePolicy('closed')"
          />
          {{ t.inboxPolicyClosed }}
        </label>
        <p v-if="policyMessage" class="text-sm text-muted-foreground">{{ policyMessage }}</p>
      </CardContent>
    </Card>

    <Dialog :open="confirmDisable" @update:open="(open: boolean) => !open && (confirmDisable = false)">
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>{{ t.slugDisableConfirm }}</DialogTitle>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="confirmDisable = false">{{ t.cancel }}</Button>
          <Button @click="confirmDisableSlug">{{ t.confirm }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
