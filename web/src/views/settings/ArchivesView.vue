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
import { Input } from '@/components/ui/input'
import { t } from '@/i18n/th'
import { archiveTs, type ArchiveRow } from '@/lib/api'
import { useUsersStore } from '@/stores/users'

const users = useUsersStore()
const target = ref<ArchiveRow | null>(null)
const typed = ref('')
const error = ref('')

onMounted(() => {
  void users.refreshArchives()
})

function expected(row: ArchiveRow) {
  return `DELETE-ARCHIVE-${archiveTs(row.archiveKey)}`
}

function ask(row: ArchiveRow) {
  target.value = row
  typed.value = ''
  error.value = ''
}

async function confirmDelete() {
  const row = target.value
  if (!row) return
  if (typed.value !== expected(row)) {
    error.value = t.forceNeedConfirm
    return
  }
  try {
    await users.removeArchive(row.archiveKey, archiveTs(row.archiveKey))
    target.value = null
  } catch {
    error.value = t.saveFailed
  }
}
</script>

<template>
  <div>
    <p class="mb-3 text-sm text-muted-foreground">{{ t.archivesHint }}</p>
    <p v-if="users.archivesStatus === 'loading'" class="text-sm text-muted-foreground">{{ t.checkingSession }}</p>
    <p v-else-if="!users.archives.length" class="text-sm text-muted-foreground">{{ t.archivesEmpty }}</p>
    <ul v-else class="space-y-2">
      <li
        v-for="row in users.archives"
        :key="row.archiveKey"
        class="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3"
      >
        <div class="min-w-0 flex-1">
          <p class="font-mono text-sm">{{ row.username || row.archiveKey }}</p>
          <p class="text-xs text-muted-foreground">
            {{ row.archivedAtLocal }} · {{ row.dataSize }} · backups {{ row.backupCount }}
            <span v-if="row.archivedBy"> · {{ row.archivedBy }}</span>
          </p>
        </div>
        <Button size="sm" variant="outline" @click="users.downloadArchive(row)">{{ t.backupDownload }}</Button>
        <Button size="sm" variant="ghost" @click="ask(row)">{{ t.delete }}</Button>
      </li>
    </ul>
    <p v-if="users.error && users.archivesStatus === 'error'" class="mt-2 text-sm text-destructive">{{ t.saveFailed }}</p>

    <Dialog :open="!!target" @update:open="(open: boolean) => !open && (target = null)">
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>{{ t.archiveDeleteTitle }}</DialogTitle>
        </DialogHeader>
        <p v-if="target" class="font-mono text-xs break-all">{{ target.archiveKey }}</p>
        <label v-if="target" class="block text-sm">
          {{ t.forceConfirmLabel }}
          <span class="mt-1 block font-mono text-xs">{{ expected(target) }}</span>
          <Input v-model="typed" class="mt-2 font-mono" autocomplete="off" />
        </label>
        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
        <DialogFooter>
          <Button variant="outline" @click="target = null">{{ t.cancel }}</Button>
          <Button @click="confirmDelete">{{ t.confirm }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
