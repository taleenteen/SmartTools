<script setup lang="ts">
import { computed } from 'vue'
import { Pin, MoreVertical, Trash2, FileText, Download } from 'lucide-vue-next'
import { Card } from '@/components/ui/card'
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
}>()

const emit = defineEmits<{
  (e: 'open', note: NoteItemSummary): void
  (e: 'pin', id: string): void
  (e: 'delete', id: string): void
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
  <Card
    class="group relative flex flex-col rounded-2xl overflow-hidden border border-border/70 hover:border-primary/50 hover:shadow-lg transition-all duration-300 bg-card cursor-pointer"
    @click="emit('open', note)"
  >
    <!-- Optional Cover Image -->
    <div v-if="note.coverUrl" class="relative w-full h-40 bg-muted/40 overflow-hidden shrink-0">
      <img
        :src="note.coverUrl"
        class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        alt="Note Cover"
      />
      <!-- Pinned badge -->
      <button
        type="button"
        :class="[
          'absolute top-3 right-3 size-8 rounded-full flex items-center justify-center backdrop-blur-md transition-all shadow-xs',
          note.pinned ? 'bg-amber-500 text-white shadow-amber-500/20' : 'bg-background/80 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100'
        ]"
        :title="note.pinned ? t.notesUnpin : t.notesPin"
        @click.stop="emit('pin', note.id)"
      >
        <Pin class="size-4 fill-current rotate-45" />
      </button>

      <!-- Project tag badge -->
      <div v-if="projectName" class="absolute bottom-2.5 left-3 bg-background/85 backdrop-blur-md px-2.5 py-0.5 rounded-full text-xs font-medium shadow-xs border border-border/50 text-foreground">
        📁 {{ projectName }}
      </div>
    </div>

    <!-- Top header without cover -->
    <div v-else class="px-5 pt-4 pb-0 flex items-center justify-between">
      <span v-if="projectName" class="text-xs font-medium text-muted-foreground flex items-center gap-1">
        📁 {{ projectName }}
      </span>
      <span v-else class="text-xs font-medium text-muted-foreground flex items-center gap-1">
        <FileText class="size-3.5 text-primary" />
        {{ t.notesStandalone }}
      </span>

      <!-- Pin Button -->
      <button
        type="button"
        :class="[
          'size-7 rounded-full flex items-center justify-center transition-all',
          note.pinned ? 'text-amber-500' : 'text-muted-foreground/50 hover:text-muted-foreground opacity-0 group-hover:opacity-100'
        ]"
        :title="note.pinned ? t.notesUnpin : t.notesPin"
        @click.stop="emit('pin', note.id)"
      >
        <Pin class="size-4 fill-current rotate-45" />
      </button>
    </div>

    <!-- Content Body -->
    <div class="p-4 sm:p-5 flex flex-col flex-1 justify-between gap-3">
      <div class="space-y-1.5">
        <h3 class="font-bold text-base sm:text-lg text-foreground group-hover:text-primary transition-colors line-clamp-2">
          {{ note.title || 'Untitled Note' }}
        </h3>
        <p class="text-xs sm:text-sm text-muted-foreground line-clamp-3 leading-relaxed">
          {{ note.snippet || 'ไม่มีเนื้อหาตัวอย่าง…' }}
        </p>
      </div>

      <!-- Footer Info and Action Row -->
      <div class="pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
        <div class="flex items-center gap-2">
          <span>{{ note.wordCount || 0 }} {{ t.notesWords }}</span>
          <span>•</span>
          <span>{{ formattedDate }}</span>
        </div>

        <div class="flex items-center gap-1" @click.stop>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button variant="ghost" size="icon" class="size-8 rounded-full text-muted-foreground hover:text-foreground">
                <MoreVertical class="size-4" />
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
    </div>
  </Card>
</template>
