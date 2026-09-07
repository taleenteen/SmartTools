<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { t } from '@/i18n/th'
import { useBackupsStore } from '@/stores/backups'
import { useEditorStore } from '@/stores/editor'

const backups = useBackupsStore()
const editor = useEditorStore()
const confirmName = ref('')
const confirmKind = ref<'restore' | 'delete' | null>(null)

onMounted(() => {
  void backups.refresh()
})

function ask(kind: 'restore' | 'delete', name: string) {
  confirmKind.value = kind
  confirmName.value = name
}

async function confirm() {
  const name = confirmName.value
  const kind = confirmKind.value
  confirmKind.value = null
  if (!name || !kind) return
  if (kind === 'restore') {
    await backups.restore(name)
    await editor.load()
  } else {
    await backups.remove(name)
  }
}
</script>

<template>
  <div>
    <p v-if="backups.status === 'loading'" class="text-sm text-muted-foreground">{{ t.checkingSession }}</p>
    <p v-else-if="!backups.items.length" class="text-sm text-muted-foreground">{{ t.backupEmpty }}</p>
    <ul v-else class="space-y-2">
      <li
        v-for="item in backups.items"
        :key="item.name"
        class="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3"
      >
        <span class="min-w-0 flex-1 font-mono text-sm">{{ item.name }}</span>
        <Button size="sm" variant="outline" @click="backups.previewBackup(item.name)">{{ t.backupPreview }}</Button>
        <Button size="sm" variant="outline" @click="backups.download(item.name)">{{ t.backupDownload }}</Button>
        <Button size="sm" variant="secondary" @click="ask('restore', item.name)">{{ t.backupRestore }}</Button>
        <Button size="sm" variant="ghost" @click="ask('delete', item.name)">{{ t.backupDelete }}</Button>
      </li>
    </ul>
    <p v-if="backups.error" class="mt-2 text-sm text-destructive">{{ t.saveFailed }}</p>

    <Dialog :open="!!backups.preview" @update:open="(open: boolean) => !open && (backups.preview = '')">
      <DialogContent class="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{{ backups.previewName }}</DialogTitle>
        </DialogHeader>
        <pre class="max-h-80 overflow-auto rounded-lg bg-muted p-3 text-xs">{{ backups.preview.slice(0, 8000) }}</pre>
      </DialogContent>
    </Dialog>

    <Dialog :open="!!confirmKind" @update:open="(open: boolean) => !open && (confirmKind = null)">
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>{{ confirmKind === 'restore' ? t.backupConfirmRestore : t.backupConfirmDelete }}</DialogTitle>
        </DialogHeader>
        <p class="font-mono text-sm">{{ confirmName }}</p>
        <DialogFooter>
          <Button variant="outline" @click="confirmKind = null">{{ t.cancel }}</Button>
          <Button @click="confirm">{{ t.confirm }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
