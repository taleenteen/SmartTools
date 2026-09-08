<script setup lang="ts">
import { Loader2, Save } from '@lucide/vue'
import { Motion } from 'motion-v'
import { onMounted, onUnmounted } from 'vue'

import { Button } from '@/components/ui/button'
import { t } from '@/i18n/th'
import { EncryptedSaveError } from '@/lib/serialize-data-js'
import { useEditorStore } from '@/stores/editor'
import { useEncryptStore } from '@/stores/encrypt'

const editor = useEditorStore()
const encrypt = useEncryptStore()

function onBeforeUnload(e: BeforeUnloadEvent) {
  if (editor.dirty) {
    e.preventDefault()
    e.returnValue = ''
  }
}

onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
onUnmounted(() => window.removeEventListener('beforeunload', onBeforeUnload))

async function onSave() {
  try {
    await editor.save()
  } catch (err) {
    if (err instanceof EncryptedSaveError) encrypt.openDialog()
  }
}
</script>

<template>
  <Motion
    v-if="editor.dirty || editor.error || editor.saveMessage"
    class="fixed inset-x-4 bottom-6 z-50 mx-auto flex max-w-lg items-center justify-between gap-3 rounded-2xl border border-border bg-card/95 px-5 py-3.5 shadow-2xl backdrop-blur-md"
    :initial="{ opacity: 0, y: 20, scale: 0.95 }"
    :animate="{ opacity: 1, y: 0, scale: 1 }"
    :exit="{ opacity: 0, y: 20, scale: 0.95 }"
    :transition="{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }"
  >
    <div class="flex min-w-0 items-center gap-2.5">
      <span
        v-if="editor.error"
        class="flex size-2.5 shrink-0 rounded-full bg-destructive"
        aria-hidden="true"
      />
      <span
        v-else-if="editor.saveMessage"
        class="flex size-2.5 shrink-0 rounded-full bg-primary"
        aria-hidden="true"
      />
      <span
        v-else
        class="relative flex size-2.5 shrink-0"
      >
        <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
        <span class="relative inline-flex size-2.5 rounded-full bg-primary" />
      </span>

      <p v-if="editor.error" class="truncate text-xs font-medium text-destructive">
        {{ editor.error }}
      </p>
      <p v-else-if="editor.saveMessage" class="truncate text-xs font-medium text-primary">
        {{ editor.saveMessage }}
      </p>
      <p v-else class="truncate text-xs font-medium text-foreground">
        {{ t.dirtyHint }}
      </p>
    </div>

    <div class="flex shrink-0 items-center gap-2">
      <Button
        size="sm"
        class="rounded-full shadow-xs"
        :disabled="editor.saving || !editor.dirty"
        @click="onSave"
      >
        <Loader2 v-if="editor.saving" class="size-3.5 animate-spin" />
        <Save v-else class="size-3.5" />
        <span>{{ t.save }}</span>
      </Button>
    </div>
  </Motion>
</template>
