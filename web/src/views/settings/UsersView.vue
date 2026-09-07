<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { t } from '@/i18n/th'
import { ApiError, getPublicSlug, migrateV2, setPublicSlug, type UserRow } from '@/lib/api'
import { slugIssue } from '@/lib/slug'
import { isValidUsername } from '@/lib/username'
import { useSessionStore } from '@/stores/session'
import { useUsersStore } from '@/stores/users'
import ArchivesView from '@/views/settings/ArchivesView.vue'

const session = useSessionStore()
const users = useUsersStore()
const panel = ref<'list' | 'archives'>('list')
const message = ref('')

const formOpen = ref<'create' | 'reset' | null>(null)
const formName = ref('')
const formPassword = ref('')
const formError = ref('')

const forceUser = ref('')
const forceTyped = ref('')
const forceKey = ref('')
const forceDownloaded = ref(false)
const forceError = ref('')
const forceBusy = ref(false)

const slugUser = ref('')
const slugValue = ref('')
const slugEnabled = ref(false)
const slugError = ref('')
const slugBusy = ref(false)
const migrateText = ref('')

const forceExpected = computed(() => (forceUser.value ? `DELETE-${forceUser.value}` : ''))

const liveSlugError = computed(() => {
  const issue = slugIssue(slugValue.value, 'admin', slugUser.value)
  if (!issue) return ''
  if (issue === 'empty') return slugEnabled.value ? t.slugNeedValue : ''
  if (issue === 'invalid') return t.slugInvalid
  if (issue === 'reserved') return t.slugReserved
  return ''
})

onMounted(() => {
  void users.refresh()
})

function openCreate() {
  formOpen.value = 'create'
  formName.value = ''
  formPassword.value = ''
  formError.value = ''
}

function openReset(row: UserRow) {
  formOpen.value = 'reset'
  formName.value = row.username
  formPassword.value = ''
  formError.value = ''
}

async function submitForm() {
  formError.value = ''
  const name = formName.value.trim()
  if (formOpen.value === 'create' && !isValidUsername(name)) {
    formError.value = t.userInvalidName
    return
  }
  if (formPassword.value.length < 4) {
    formError.value = t.passwordTooShort
    return
  }
  try {
    await users.createOrReset(name, formPassword.value)
    message.value = formOpen.value === 'create' ? t.userCreated : t.userResetOk
    formOpen.value = null
    formPassword.value = ''
  } catch {
    formError.value = t.saveFailed
  }
}

async function removeEmpty(row: UserRow) {
  if (row.username === session.username) {
    message.value = t.userCannotSelf
    return
  }
  try {
    await users.remove(row.username)
    message.value = t.userDeleted
  } catch (err) {
    if (err instanceof ApiError && err.requiresForce) openForce(row)
    else message.value = t.saveFailed
  }
}

function openForce(row: UserRow) {
  if (row.username === session.username) {
    message.value = t.userCannotSelf
    return
  }
  forceUser.value = row.username
  forceTyped.value = ''
  forceKey.value = ''
  forceDownloaded.value = false
  forceError.value = ''
}

async function runArchive() {
  if (forceTyped.value !== forceExpected.value) {
    forceError.value = t.forceNeedConfirm
    return
  }
  forceBusy.value = true
  forceError.value = ''
  try {
    forceKey.value = await users.archiveOnly(forceUser.value)
    forceDownloaded.value = false
  } catch {
    forceError.value = t.saveFailed
  } finally {
    forceBusy.value = false
  }
}

async function downloadForce() {
  if (!forceKey.value) return
  try {
    await users.downloadArchiveByKey(forceKey.value, forceUser.value)
    forceDownloaded.value = true
    forceError.value = ''
  } catch {
    forceError.value = t.saveFailed
  }
}

async function runCleanup() {
  if (!forceDownloaded.value) {
    forceError.value = t.forceNeedDownload
    return
  }
  forceBusy.value = true
  try {
    await users.cleanup(forceUser.value, forceKey.value)
    forceUser.value = ''
    message.value = t.userDeleted
  } catch {
    forceError.value = t.saveFailed
  } finally {
    forceBusy.value = false
  }
}

async function openSlug(row: UserRow) {
  slugUser.value = row.username
  slugError.value = ''
  try {
    const state = await getPublicSlug(row.username)
    slugValue.value = state.slug
    slugEnabled.value = state.enabled
  } catch {
    slugValue.value = row.publicSlug
    slugEnabled.value = row.publicEnabled
  }
}

async function saveSlug() {
  if (liveSlugError.value) {
    slugError.value = liveSlugError.value
    return
  }
  slugBusy.value = true
  slugError.value = ''
  try {
    await setPublicSlug(slugUser.value, slugValue.value.trim().toLowerCase(), slugEnabled.value)
    await users.refresh()
    slugUser.value = ''
    message.value = t.slugOk
  } catch (err) {
    slugError.value = err instanceof ApiError && err.conflict ? t.slugTaken : t.saveFailed
  } finally {
    slugBusy.value = false
  }
}

async function runMigrate(dryRun: boolean) {
  migrateText.value = ''
  try {
    const body = await migrateV2(dryRun)
    migrateText.value = typeof body.note === 'string' ? body.note : JSON.stringify(body)
    if (!dryRun) await session.check()
  } catch {
    migrateText.value = t.saveFailed
  }
}
</script>

<template>
  <div>
    <div
      v-if="session.migrationNeeded"
      class="mb-4 rounded-xl border border-border bg-card p-3 text-sm"
    >
      <p class="font-medium">{{ t.migrateTitle }}</p>
      <p class="mt-1 text-muted-foreground">{{ t.migrateHint }}</p>
      <div class="mt-2 flex gap-2">
        <Button size="sm" variant="outline" @click="runMigrate(true)">{{ t.migrateDryRun }}</Button>
        <Button size="sm" @click="runMigrate(false)">{{ t.migrateRun }}</Button>
      </div>
      <p v-if="migrateText" class="mt-2 font-mono text-xs">{{ migrateText }}</p>
    </div>
    <div class="mb-4 flex flex-wrap items-center gap-2">
      <Button size="sm" class="rounded-full" :variant="panel === 'list' ? 'default' : 'outline'" @click="panel = 'list'">
        {{ t.archivesHide }}
      </Button>
      <Button
        size="sm"
        class="rounded-full"
        :variant="panel === 'archives' ? 'default' : 'outline'"
        @click="panel = 'archives'"
      >
        {{ t.archivesShow }}
      </Button>
      <Button v-if="panel === 'list'" size="sm" class="ml-auto rounded-full" @click="openCreate">{{ t.userNew }}</Button>
    </div>

    <ArchivesView v-if="panel === 'archives'" />

    <div v-else>
      <p class="mb-3 text-sm text-muted-foreground">{{ t.usersHint }}</p>
      <p v-if="users.status === 'loading'" class="text-sm text-muted-foreground">{{ t.checkingSession }}</p>
      <p v-else-if="!users.items.length" class="text-sm text-muted-foreground">{{ t.usersEmpty }}</p>
      <ul v-else class="space-y-2">
        <li
          v-for="row in users.items"
          :key="row.username"
          class="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3"
        >
          <div class="min-w-0 flex-1">
            <p class="font-mono text-sm">
              {{ row.username }}
              <span class="ml-2 text-xs text-muted-foreground">{{ row.role }} · {{ row.algo }}</span>
            </p>
            <p class="text-xs text-muted-foreground">
              {{ row.hasData ? t.userHasData : t.userNoData }}
              <span v-if="row.publicEnabled && row.publicSlug" class="text-primary"> · {{ row.publicSlug }}</span>
            </p>
          </div>
          <Button size="sm" variant="outline" @click="openSlug(row)">{{ t.userSlug }}</Button>
          <Button size="sm" variant="outline" @click="openReset(row)">{{ t.userReset }}</Button>
          <template v-if="row.username !== session.username">
            <Button v-if="row.hasData" size="sm" variant="secondary" @click="openForce(row)">{{ t.userForce }}</Button>
            <Button v-else size="sm" variant="ghost" @click="removeEmpty(row)">{{ t.delete }}</Button>
          </template>
        </li>
      </ul>
      <p v-if="message" class="mt-2 text-sm text-muted-foreground">{{ message }}</p>
      <p v-if="users.error && users.status === 'error'" class="mt-2 text-sm text-destructive">{{ t.saveFailed }}</p>
    </div>

    <Dialog :open="!!formOpen" @update:open="(open: boolean) => !open && (formOpen = null)">
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>{{ formOpen === 'create' ? t.userNew : t.userReset }}</DialogTitle>
        </DialogHeader>
        <label class="block text-sm">
          {{ t.username }}
          <Input v-model="formName" class="mt-1" :readonly="formOpen === 'reset'" autocomplete="off" />
        </label>
        <p v-if="formOpen === 'create'" class="text-xs text-muted-foreground">{{ t.userNameHint }}</p>
        <label class="block text-sm">
          {{ t.password }}
          <Input v-model="formPassword" class="mt-1" type="password" autocomplete="new-password" />
        </label>
        <p v-if="formError" class="text-sm text-destructive">{{ formError }}</p>
        <DialogFooter>
          <Button variant="outline" @click="formOpen = null">{{ t.cancel }}</Button>
          <Button @click="submitForm">{{ t.confirm }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog :open="!!forceUser" @update:open="(open: boolean) => !open && (forceUser = '')">
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>{{ t.forceTitle }}</DialogTitle>
        </DialogHeader>
        <p class="text-sm text-muted-foreground">{{ t.forceHint }}</p>
        <p class="font-mono text-sm">{{ forceUser }}</p>
        <template v-if="!forceKey">
          <label class="block text-sm">
            {{ t.forceConfirmLabel }}
            <span class="mt-1 block font-mono text-xs">{{ forceExpected }}</span>
            <Input v-model="forceTyped" class="mt-2 font-mono" autocomplete="off" />
          </label>
        </template>
        <p v-else class="text-sm">{{ t.forceArchived }}</p>
        <p v-if="forceKey" class="font-mono text-xs break-all">{{ forceKey }}</p>
        <p v-if="forceError" class="text-sm text-destructive">{{ forceError }}</p>
        <DialogFooter>
          <Button variant="outline" @click="forceUser = ''">{{ t.cancel }}</Button>
          <Button v-if="!forceKey" :disabled="forceBusy" @click="runArchive">{{ t.forceArchive }}</Button>
          <Button v-else variant="outline" @click="downloadForce">{{ t.forceDownload }}</Button>
          <Button v-if="forceKey" :disabled="forceBusy || !forceDownloaded" @click="runCleanup">{{ t.forceCleanup }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog :open="!!slugUser" @update:open="(open: boolean) => !open && (slugUser = '')">
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>{{ t.userSlug }}</DialogTitle>
        </DialogHeader>
        <p class="font-mono text-sm">{{ slugUser }}</p>
        <label class="flex items-center gap-2 text-sm">
          <input v-model="slugEnabled" type="checkbox" />
          {{ t.slugEnabled }}
        </label>
        <label class="block text-sm">
          {{ t.slugField }}
          <Input v-model="slugValue" class="mt-1 font-mono" autocomplete="off" maxlength="32" />
        </label>
        <p v-if="liveSlugError || slugError" class="text-sm text-destructive">{{ slugError || liveSlugError }}</p>
        <DialogFooter>
          <Button variant="outline" @click="slugUser = ''">{{ t.cancel }}</Button>
          <Button :disabled="slugBusy || !!liveSlugError" @click="saveSlug">{{ t.slugSave }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
