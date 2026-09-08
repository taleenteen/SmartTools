<script setup lang="ts">
import { ArrowDown, ArrowUp, BookOpen, Pencil, Plus, Trash2 } from '@lucide/vue'
import { ref } from 'vue'

import MangaEditorDialog from '@/components/manga/MangaEditorDialog.vue'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { useManga } from '@/composables/useManga'
import { t } from '@/i18n/th'
import {
  ensureMangaSection,
  MANGA_SECTION_KEY,
  resolveChapterUrl,
  type MangaItem,
} from '@/lib/manga'
import { useEditorStore } from '@/stores/editor'

const editor = useEditorStore()
const { mangaList, saveManga, removeManga } = useManga()

const editorOpen = ref(false)
const editingManga = ref<MangaItem | null>(null)
const deleteTarget = ref<MangaItem | null>(null)

function openAdd() {
  editingManga.value = null
  editorOpen.value = true
}

function openEdit(item: MangaItem) {
  editingManga.value = { ...item }
  editorOpen.value = true
}

function askDelete(item: MangaItem) {
  deleteTarget.value = item
}

async function confirmDelete() {
  if (deleteTarget.value) {
    await removeManga(deleteTarget.value.id)
    deleteTarget.value = null
  }
}

function moveManga(index: number, delta: number) {
  const { sections, mangaSection } = ensureMangaSection(editor.sections)
  const next = index + delta
  if (next < 0 || next >= mangaSection.cards.length) return

  const copy = [...mangaSection.cards]
  const a = copy[index]
  const b = copy[next]
  if (!a || !b) return
  copy[index] = b
  copy[next] = a

  editor.sections = sections.map((s) => (s.key === MANGA_SECTION_KEY ? { ...s, cards: copy } : s))
  editor.dirty = true
  void editor.save()
}
</script>

<template>
  <div>
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="text-sm font-semibold text-foreground">{{ t.manga }}</p>
        <p class="text-xs text-muted-foreground">{{ t.mangaSubtitle }}</p>
      </div>

      <Button size="sm" class="rounded-full shadow-xs" @click="openAdd">
        <Plus class="mr-1.5 size-3.5" />
        {{ t.mangaAdd }}
      </Button>
    </div>

    <!-- Empty State -->
    <p v-if="!mangaList.length" class="text-sm text-muted-foreground py-6 text-center">
      {{ t.mangaEmpty }}
    </p>

    <!-- 2-Column Responsive Management Grid -->
    <ul v-else class="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
      <li
        v-for="(item, index) in mangaList"
        :key="item.id"
        class="group flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-xs transition-colors hover:border-ring/30"
      >
        <!-- Cover Preview -->
        <div
          class="relative aspect-[2/3] w-12 shrink-0 overflow-hidden rounded-lg border border-border bg-muted/40"
        >
          <img
            v-if="item.coverUrl"
            :src="item.coverUrl"
            :alt="item.title"
            class="size-full object-cover"
          />
          <div v-else class="flex size-full items-center justify-center text-muted-foreground">
            <BookOpen class="size-4" />
          </div>
        </div>

        <!-- Info -->
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5">
            <p class="truncate text-sm font-medium text-foreground">{{ item.title }}</p>
            <span class="shrink-0 rounded-md bg-primary-wash px-1.5 py-0.2 text-[10px] font-semibold text-primary">
              {{ t.mangaChapter }} {{ item.currentChapter }}
            </span>
          </div>
          <p class="truncate font-mono text-xs text-muted-foreground">
            {{ item.latestUrl || resolveChapterUrl(item.urlPattern, item.currentChapter) }}
          </p>
        </div>

        <!-- Row Actions -->
        <div class="flex items-center gap-1">
          <!-- Move Up/Down -->
          <Button
            size="icon"
            variant="ghost"
            class="size-8 text-muted-foreground hover:text-foreground"
            :disabled="index === 0"
            :title="t.moveUp"
            @click="moveManga(index, -1)"
          >
            <ArrowUp class="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            class="size-8 text-muted-foreground hover:text-foreground"
            :disabled="index === mangaList.length - 1"
            :title="t.moveDown"
            @click="moveManga(index, 1)"
          >
            <ArrowDown class="size-4" />
          </Button>

          <!-- Edit -->
          <Button
            size="icon"
            variant="ghost"
            class="size-8 text-muted-foreground hover:text-foreground"
            :title="t.edit"
            @click="openEdit(item)"
          >
            <Pencil class="size-3.5" />
          </Button>

          <!-- Delete -->
          <Button
            size="icon"
            variant="ghost"
            class="size-8 text-muted-foreground hover:text-destructive"
            :title="t.delete"
            @click="askDelete(item)"
          >
            <Trash2 class="size-3.5" />
          </Button>
        </div>
      </li>
    </ul>

    <!-- Editor Dialog -->
    <MangaEditorDialog
      v-model:open="editorOpen"
      :manga="editingManga"
      @save="saveManga"
    />

    <!-- Delete Confirmation -->
    <AlertDialog :open="!!deleteTarget" @update:open="(val: boolean) => !val && (deleteTarget = null)">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t.mangaDelete }}</AlertDialogTitle>
          <AlertDialogDescription>{{ t.mangaDeleteConfirm }}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ t.cancel }}</AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            @click="confirmDelete"
          >
            {{ t.delete }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
