<script setup lang="ts">
import { ref, watch } from 'vue'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { t } from '@/i18n/th'
import { useEncryptStore } from '@/stores/encrypt'

const encrypt = useEncryptStore()
const password = ref('')

watch(
  () => encrypt.dialogOpen,
  (open) => {
    if (open) password.value = ''
  },
)

async function submit() {
  const ok = await encrypt.unlock(password.value)
  if (ok) {
    password.value = ''
    encrypt.closeDialog()
  }
}
</script>

<template>
  <Dialog :open="encrypt.dialogOpen" @update:open="(open: boolean) => !open && encrypt.closeDialog()">
    <DialogContent class="sm:max-w-md p-6">
      <DialogHeader>
        <DialogTitle class="text-lg font-semibold">{{ t.unlock }}</DialogTitle>
        <DialogDescription class="text-xs text-muted-foreground">{{ t.unlockHint }}</DialogDescription>
      </DialogHeader>
      <form class="space-y-3" @submit.prevent="submit">
        <Input
          v-model="password"
          type="password"
          autocomplete="current-password"
          :placeholder="t.unlockPassword"
          :disabled="encrypt.busy"
        />
        <p v-if="encrypt.error" class="text-sm text-destructive">{{ t.unlockWrong }}</p>
        <DialogFooter class="gap-2">
          <Button type="button" variant="outline" @click="encrypt.closeDialog()">{{ t.noteCancel }}</Button>
          <Button type="submit" :disabled="encrypt.busy || !password">{{ t.unlock }}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
