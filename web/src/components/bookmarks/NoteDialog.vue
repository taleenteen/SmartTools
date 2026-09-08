<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { t } from '@/i18n/th'
import { patchComment } from '@/lib/api'
import { commentPathForCard } from '@/lib/comment-path'
import { effectiveComment, writeCommentOverride } from '@/lib/comment-overrides'
import { renderMarkdown } from '@/lib/render-markdown'
import { useBookmarksStore } from '@/stores/bookmarks'
import { useEncryptStore } from '@/stores/encrypt'
import { useModeStore } from '@/stores/mode'
import { useSessionStore } from '@/stores/session'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
const encrypt = useEncryptStore()
const session = useSessionStore()
const mode = useModeStore()
const bookmarks = useBookmarksStore()
const editing = ref(false)
const draft = ref('')

const open = computed(() => !!ui.note)
const comment = computed(() => (ui.note ? effectiveComment(ui.note.card, ui.note.cardId) : ''))
const canEdit = computed(() => {
  if (!ui.note || ui.note.encrypted) return encrypt.hasPassword
  if (mode.kind === 'local') return mode.folderReady
  return session.loggedIn
})
const html = computed(() => renderMarkdown(editing.value ? draft.value : comment.value))

watch(
  () => ui.note,
  (target) => {
    editing.value = false
    draft.value = target ? effectiveComment(target.card, target.cardId) : ''
  },
)

function followLink() {
  const href = ui.note?.href
  ui.closeNote()
  if (href) window.open(href, '_blank', 'noopener,noreferrer')
}

async function save() {
  if (!ui.note || !canEdit.value) return
  writeCommentOverride(ui.note.cardId, draft.value)
  ui.note.card.comment = draft.value
  if (session.loggedIn && mode.kind === 'online') {
    const path = commentPathForCard(bookmarks.sections, ui.note.cardId)
    if (path) {
      try {
        await patchComment(path, draft.value)
      } catch {
        /* keep local override */
      }
    }
  }
  editing.value = false
}
</script>

<template>
  <Dialog :open="open" @update:open="(value: boolean) => !value && ui.closeNote()">
    <DialogContent class="sm:max-w-xl max-h-[85vh] flex flex-col p-6 gap-0">
      <DialogHeader class="shrink-0 pb-3 border-b border-border/50">
        <DialogTitle class="text-lg font-semibold">{{ t.note }}</DialogTitle>
      </DialogHeader>

      <div class="flex-1 overflow-y-auto py-4 pr-1 [scrollbar-width:thin]">
        <Textarea v-if="editing" v-model="draft" class="min-h-48 font-mono text-sm" placeholder="Markdown note..." />
        <div
          v-else
          class="prose prose-sm max-w-none text-sm leading-6 text-foreground [&_a]:text-primary [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3"
          @click.self="followLink"
          v-html="html || `<p class='text-muted-foreground'>${t.noteEmpty}</p>`"
        />
      </div>

      <DialogFooter class="shrink-0 pt-3 border-t border-border/50 gap-2 sm:gap-2">
        <Button v-if="ui.note?.href" variant="outline" @click="followLink">{{ t.noteOpenLink }}</Button>
        <Button v-if="canEdit && !editing" variant="secondary" @click="editing = true">{{ t.noteEdit }}</Button>
        <Button v-if="editing" @click="save()">{{ t.noteSave }}</Button>
        <Button variant="ghost" @click="ui.closeNote()">{{ t.noteCancel }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
