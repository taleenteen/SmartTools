<script setup lang="ts">
import { computed, ref } from 'vue'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { t } from '@/i18n/th'
import {
  hasLocalCreds,
  loginLocal,
  registerLocal,
  resetLocalCreds,
} from '@/lib/local-auth'
import { useModeStore } from '@/stores/mode'
import { useSessionStore } from '@/stores/session'

const session = useSessionStore()
const mode = useModeStore()
const username = ref('')
const password = ref('')
const confirm = ref('')
const submitting = ref(false)
const localError = ref('')
const registered = computed(() => hasLocalCreds())

async function onSubmit() {
  submitting.value = true
  localError.value = ''
  try {
    if (mode.kind === 'local') {
      if (!registered.value) {
        if (password.value.length < 4) {
          localError.value = t.passwordTooShort
          return
        }
        if (password.value !== confirm.value) {
          localError.value = t.passwordMismatch
          return
        }
        await registerLocal(username.value, password.value)
      } else {
        const ok = await loginLocal(username.value, password.value)
        if (!ok) {
          localError.value = t.loginFailed
          return
        }
      }
      await mode.restoreFolder()
      session.adoptLocal(username.value.trim())
      return
    }
    await session.login(username.value, password.value)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="mx-auto w-full max-w-sm space-y-4">
    <div class="grid grid-cols-2 gap-2">
      <button
        type="button"
        class="rounded-xl border p-3 text-left text-sm transition-colors hover:bg-card-hover focus-visible:ring-2 focus-visible:ring-ring"
        :class="mode.kind === 'online' ? 'border-primary bg-primary-wash' : 'border-border bg-card'"
        @click="mode.setKind('online')"
      >
        <p class="font-semibold">{{ t.modeOnline }}</p>
        <p class="mt-1 text-xs text-muted-foreground">{{ t.modeOnlineHint }}</p>
      </button>
      <button
        type="button"
        class="rounded-xl border p-3 text-left text-sm transition-colors hover:bg-card-hover focus-visible:ring-2 focus-visible:ring-ring"
        :class="mode.kind === 'local' ? 'border-primary bg-primary-wash' : 'border-border bg-card'"
        @click="mode.setKind('local')"
      >
        <p class="font-semibold">{{ t.modeLocal }}</p>
        <p class="mt-1 text-xs text-muted-foreground">{{ t.modeLocalHint }}</p>
      </button>
    </div>
    <p v-if="mode.kind === 'local' && !mode.supported" class="text-sm text-destructive">{{ t.folderUnsupported }}</p>

    <div class="rounded-xl border border-border bg-card p-6 shadow-md">
      <h1 class="text-xl font-semibold text-foreground">{{ t.loginTitle }}</h1>
      <p class="mt-2 text-sm text-muted-foreground">
        {{ mode.kind === 'local' && !registered ? t.localRegister : t.loginHint }}
      </p>
      <form class="mt-6 space-y-3" @submit.prevent="onSubmit">
        <label class="block text-sm font-medium">
          {{ t.username }}
          <Input v-model="username" class="mt-1" autocomplete="username" />
        </label>
        <label class="block text-sm font-medium">
          {{ t.password }}
          <Input v-model="password" class="mt-1" type="password" autocomplete="current-password" />
        </label>
        <label v-if="mode.kind === 'local' && !registered" class="block text-sm font-medium">
          {{ t.passwordConfirm }}
          <Input v-model="confirm" class="mt-1" type="password" autocomplete="new-password" />
        </label>
        <p v-if="localError || session.error" class="text-sm text-destructive">{{ localError || session.error }}</p>
        <Button class="w-full" type="submit" :disabled="submitting">{{ t.login }}</Button>
      </form>
      <button
        v-if="mode.kind === 'local' && registered"
        type="button"
        class="mt-3 text-xs text-muted-foreground underline"
        @click="resetLocalCreds(); localError = ''"
      >
        {{ t.localResetCreds }}
      </button>
    </div>
  </div>
</template>
