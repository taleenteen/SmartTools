<script setup lang="ts">
import { computed } from 'vue'
import { FileText, Pin, MoreVertical, Trash2, Download, ArrowUp, ArrowDown } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { t } from '@/i18n/th'
import type { NoteItemSummary } from '@/types/note'

const props = defineProps<{
  note: NoteItemSummary
  projectName?: string
  canReorder?: boolean
  isFirst?: boolean
  isLast?: boolean
}>()

const emit = defineEmits<{
  (e: 'open', note: NoteItemSummary): void
  (e: 'pin', id: string): void
  (e: 'delete', id: string): void
  (e: 'move-up', id: string): void
  (e: 'move-down', id: string): void
  (e: 'export', note: NoteItemSummary, format: 'md' | 'html' | 'txt'): void
}>()

const formattedDate = computed(() => {
  if (!props.note.updatedAt) return ''
  try {
    const d = new Date(props.note.updatedAt)
    return d.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: '2-digit',
    })
  } catch {
    return ''
  }
})
</script>

<template>
  <div
    class="group flex items-center justify-between px-4 py-3 rounded-xl border border-transparent hover:border-border/80 hover:bg-muted/40 transition-colors cursor-pointer text-sm"
    @click="emit('open', note)"
  >
    <!-- Column 1: Icon + Title + Pinned -->
    <div class="flex items-center gap-3 min-w-0 flex-1 pr-4">
      <div class="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <FileText class="size-4.5" />
      </div>

      <div class="min-w-0 flex items-center gap-2">
        <span class="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
          {{ note.title || 'Untitled Note' }}
        </span>
        <Pin v-if="note.pinned" class="size-3.5 text-amber-500 fill-amber-500 shrink-0 rotate-45" />
      </div>
    </div>

    <!-- Column 2: Folder Location -->
    <div class="hidden sm:flex items-center w-36 shrink-0 text-xs text-muted-foreground">
      <span v-if="projectName" class="truncate bg-muted px-2 py-0.5 rounded-md">
        📁 {{ projectName }}
      </span>
      <span v-else class="text-muted-foreground/60">
        {{ t.notesStandalone }}
      </span>
    </div>

    <!-- Column 3: Word Count -->
    <div class="hidden md:flex items-center justify-end w-24 shrink-0 text-xs text-muted-foreground">
      <span>{{ note.wordCount || 0 }} {{ t.notesWords }}</span>
    </div>

    <!-- Column 4: Last Modified Date -->
    <div class="hidden sm:flex items-center justify-end w-28 shrink-0 text-xs text-muted-foreground">
      <span>{{ formattedDate }}</span>
    </div>

    <!-- Column 5: Reorder & Actions -->
    <div class="flex items-center justify-end gap-1 w-24 shrink-0" @click.stop>
      <!-- Reorder buttons inside project -->
      <template v-if="canReorder">
        <Button
          variant="ghost"
          size="icon"
          :disabled="isFirst"
          class="size-7 rounded-lg text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
          :title="t.notesMoveUp"
          @click="emit('move-up', note.id)"
        >
          <ArrowUp class="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          :disabled="isLast"
          class="size-7 rounded-lg text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
          :title="t.notesMoveDown"
          @click="emit('move-down', note.id)"
        >
          <ArrowDown class="size-3.5" />
        </Button>
      </template>

      <!-- Pin quick toggle -->
      <Button
        variant="ghost"
        size="icon"
        :class="[
          'size-7 rounded-lg transition-all',
          note.pinned ? 'text-amber-500' : 'text-muted-foreground/50 hover:text-muted-foreground opacity-0 group-hover:opacity-100'
        ]"
        :title="note.pinned ? t.notesUnpin : t.notesPin"
        @click="emit('pin', note.id)"
      >
        <Pin class="size-3.5 fill-current rotate-45" />
      </Button>

      <!-- More Dropdown -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="icon" class="size-7 rounded-lg text-muted-foreground hover:text-foreground">
            <MoreVertical class="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-44 rounded-xl shadow-lg">
          <DropdownMenuItem class="cursor-pointer gap-2" @click="emit('pin', note.id)">
            <Pin class="size-4" />
            <span>{{ note.pinned ? t.notesUnpin : t.notesPin }}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem class="cursor-pointer gap-2" @click="emit('export', note, 'md')">
            <Download class="size-4" />
            <span>{{ t.notesExportMd }}</span>
          </DropdownMenuItem>
          <DropdownMenuItem class="cursor-pointer gap-2" @click="emit('export', note, 'html')">
            <Download class="size-4" />
            <span>{{ t.notesExportHtml }}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem class="cursor-pointer gap-2 text-destructive focus:text-destructive" @click="emit('delete', note.id)">
            <Trash2 class="size-4" />
            <span>{{ t.notesDeleteNote }}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>
</template>
