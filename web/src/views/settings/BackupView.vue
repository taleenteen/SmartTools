<script setup lang="ts">
import { Download, Eye, History, RotateCcw, Trash2 } from '@lucide/vue'
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

function formatBackupName(name: string): { title: string; subtitle: string } {
  const clean = name.replace(/^(fav_)?backup_/, '')
  const num = Number(clean)
  let date: Date | null = null
  if (!Number.isNaN(num) && num > 1000000000) {
    date = new Date(num > 1000000000000 ? num : num * 1000)
  } else {
    const parsed = Date.parse(clean.replace(/_/g, ':'))
    if (!Number.isNaN(parsed)) {
      date = new Date(parsed)
    }
  }

  if (date) {
    try {
      const formatted = new Intl.DateTimeFormat('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date)
      return { title: formatted, subtitle: name }
    } catch {
      return { title: name, subtitle: '' }
    }
  }
  return { title: name, subtitle: '' }
}

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
    <ul v-else class="space-y-2.5">
      <li
        v-for="item in backups.items"
        :key="item.name"
        class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3.5 shadow-xs transition-colors hover:border-ring/30"
      >
        <div class="flex items-center gap-3 min-w-0">
          <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <History class="size-4" />
          </div>
          <div class="min-w-0">
            <p class="text-sm font-medium text-foreground">
              {{ formatBackupName(item.name).title }}
            </p>
            <p v-if="formatBackupName(item.name).subtitle" class="font-mono text-[11px] text-muted-foreground truncate max-w-xs sm:max-w-md">
              {{ formatBackupName(item.name).subtitle }}
            </p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-1.5 ml-auto">
          <Button
            size="sm"
            variant="outline"
            class="h-8 gap-1 rounded-lg px-2.5 text-xs"
            :title="t.backupPreview"
            @click="backups.previewBackup(item.name)"
          >
            <Eye class="size-3.5" />
            <span>{{ t.backupPreview }}</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            class="h-8 gap-1 rounded-lg px-2.5 text-xs"
            :title="t.backupDownload"
            @click="backups.download(item.name)"
          >
            <Download class="size-3.5" />
            <span>{{ t.backupDownload }}</span>
          </Button>
          <Button
            size="sm"
            variant="secondary"
            class="h-8 gap-1 rounded-lg px-2.5 text-xs"
            @click="ask('restore', item.name)"
          >
            <RotateCcw class="size-3.5" />
            <span>{{ t.backupRestore }}</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            class="h-8 gap-1 rounded-lg px-2 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            @click="ask('delete', item.name)"
          >
            <Trash2 class="size-3.5" />
            <span class="sr-only">{{ t.backupDelete }}</span>
          </Button>
        </div>
      </li>
    </ul>
    <p v-if="backups.error" class="mt-2 text-sm text-destructive">{{ t.saveFailed }}</p>

    <Dialog :open="!!backups.preview" @update:open="(open: boolean) => !open && (backups.preview = '')">
      <DialogContent class="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{{ backups.previewName }}</DialogTitle>
        </DialogHeader>
        <pre class="max-h-80 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs">{{ backups.preview.slice(0, 8000) }}</pre>
      </DialogContent>
    </Dialog>

    <Dialog :open="!!confirmKind" @update:open="(open: boolean) => !open && (confirmKind = null)">
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>{{ confirmKind === 'restore' ? t.backupConfirmRestore : t.backupConfirmDelete }}</DialogTitle>
        </DialogHeader>
        <p class="font-mono text-xs break-all text-muted-foreground">{{ confirmName }}</p>
        <DialogFooter>
          <Button variant="outline" @click="confirmKind = null">{{ t.cancel }}</Button>
          <Button
            :class="confirmKind === 'delete' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''"
            @click="confirm"
          >
            {{ t.confirm }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
