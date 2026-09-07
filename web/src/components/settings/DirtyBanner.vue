<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { t } from '@/i18n/th'
import { EncryptedSaveError } from '@/lib/serialize-data-js'
import { useEditorStore } from '@/stores/editor'
import { useEncryptStore } from '@/stores/encrypt'

const editor = useEditorStore()
const encrypt = useEncryptStore()

async function onSave() {
  try {
    await editor.save()
  } catch (err) {
    if (err instanceof EncryptedSaveError) encrypt.openDialog()
  }
}
</script>

<template>
  <div
    v-if="editor.dirty || editor.error || editor.saveMessage"
    class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm shadow-sm"
  >
    <p v-if="editor.error" class="text-destructive">{{ editor.error }}</p>
    <p v-else-if="editor.saveMessage" class="text-primary">{{ editor.saveMessage }}</p>
    <p v-else class="text-muted-foreground">{{ t.dirtyHint }}</p>
    <Button size="sm" class="rounded-full" :disabled="editor.saving || !editor.dirty" @click="onSave">
      {{ t.save }}
    </Button>
  </div>
</template>
