<script setup lang="ts">
import { ref } from 'vue'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { t } from '@/i18n/th'
import { applyCsvRows, csvToCardRows, sectionsToCsv } from '@/lib/csv'
import { sectionsToXlsx, xlsxToCardRows } from '@/lib/xlsx'
import { parseDataJs } from '@/lib/parse-data-js'
import { EncryptedSaveError, prepareSectionsForSave, serializeDataJs } from '@/lib/serialize-data-js'
import { useEditorStore } from '@/stores/editor'
import { useEncryptStore } from '@/stores/encrypt'

const editor = useEditorStore()
const encrypt = useEncryptStore()
const paste = ref('')
const csvMode = ref<'append' | 'overwrite'>('append')
const message = ref('')

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

async function exportJs() {
  message.value = ''
  try {
    const prepared = await prepareSectionsForSave(editor.sections)
    const { text } = serializeDataJs(prepared, editor.meta)
    download('data.js', text, 'text/javascript;charset=utf-8')
  } catch (err) {
    if (err instanceof EncryptedSaveError) {
      message.value = t.saveNeedUnlock
      encrypt.openDialog()
    } else {
      message.value = t.saveFailed
    }
  }
}

function importJs() {
  message.value = ''
  try {
    const parsed = parseDataJs(paste.value)
    if (!parsed.sections.length) throw new Error('empty')
    editor.replaceAll(parsed.sections)
    message.value = t.importHint
  } catch {
    message.value = t.importFailed
  }
}

function onFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (/\.xlsx$/i.test(file.name)) {
    void file.arrayBuffer().then((buffer) => {
      try {
        const rows = xlsxToCardRows(buffer)
        editor.replaceAll(applyCsvRows(editor.sections, rows, csvMode.value))
        message.value = t.importHint
      } catch {
        message.value = t.importFailed
      }
    })
    return
  }
  void file.text().then((text) => {
    paste.value = text
  })
}

function exportCsv() {
  message.value = t.csvLockedSkip
  download('bookmarks.csv', sectionsToCsv(editor.sections), 'text/csv;charset=utf-8')
}

function importCsv() {
  message.value = ''
  try {
    const rows = csvToCardRows(paste.value)
    editor.replaceAll(applyCsvRows(editor.sections, rows, csvMode.value))
    message.value = t.importHint
  } catch {
    message.value = t.importFailed
  }
}

function exportXlsx() {
  message.value = t.csvLockedSkip
  const blob = sectionsToXlsx(editor.sections)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'bookmarks.xlsx'
  link.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="space-y-4">
    <p class="text-sm text-muted-foreground">{{ t.importHint }}</p>
    <div class="flex flex-wrap gap-2">
      <Button size="sm" @click="exportJs">{{ t.exportJs }}</Button>
      <Button size="sm" variant="outline" @click="importJs">{{ t.importJs }}</Button>
      <Button size="sm" variant="outline" @click="exportCsv">{{ t.exportCsv }}</Button>
      <Button size="sm" variant="outline" @click="importCsv">{{ t.importCsv }}</Button>
      <Button size="sm" variant="outline" @click="exportXlsx">{{ t.exportXlsx }}</Button>
    </div>
    <label class="block text-sm">
      {{ t.csvModeAppend }} / {{ t.csvModeOverwrite }}
      <select v-model="csvMode" class="border-input mt-1 h-8 rounded-lg border bg-transparent px-2">
        <option value="append">{{ t.csvModeAppend }}</option>
        <option value="overwrite">{{ t.csvModeOverwrite }}</option>
      </select>
    </label>
    <label class="block text-sm text-muted-foreground">
      {{ t.importXlsx }}
      <input class="mt-1 block" type="file" accept=".js,.txt,.csv,.xlsx" @change="onFile" />
    </label>
    <Textarea v-model="paste" class="min-h-48 font-mono text-xs" />
    <p v-if="message" class="text-sm text-muted-foreground">{{ message }}</p>
  </div>
</template>
