<script setup lang="ts">
import { BookOpen, Plus, Search } from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

import AppNavbar from '@/components/bookmarks/AppNavbar.vue'
import MangaCard from '@/components/manga/MangaCard.vue'
import MangaDetailsDialog from '@/components/manga/MangaDetailsDialog.vue'
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
import { Input } from '@/components/ui/input'
import { useManga } from '@/composables/useManga'
import { t } from '@/i18n/th'
import { readPublicSlug } from '@/lib/public-slug'
import { useBookmarksStore } from '@/stores/bookmarks'
import { useEditorStore } from '@/stores/editor'
import { useModeStore } from '@/stores/mode'
import { useSessionStore } from '@/stores/session'
import type { MangaItem } from '@/lib/manga'

const bookmarks = useBookmarksStore()
const editor = useEditorStore()
const session = useSessionStore()
const mode = useModeStore()
const { mangaList, stepChapter, updateChapter, removeManga } = useManga()

const searchQuery = ref('')
const selectedManga = ref<MangaItem | null>(null)
const detailsOpen = ref(false)
const editorOpen = ref(false)
const editingManga = ref<MangaItem | null>(null)
const showLoginAlert = ref(false)
const actionError = ref('')

const filteredManga = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return mangaList.value
  return mangaList.value.filter(
    (m) =>
      m.title.toLowerCase().includes(q) ||
      String(m.currentChapter).includes(q) ||
      (m.note && m.note.toLowerCase().includes(q)),
  )
})

onMounted(async () => {
  await session.check()
  if (mode.kind === 'local') {
    await mode.restoreFolder().catch(() => undefined)
    if (mode.folderReady && editor.status !== 'ready') {
      await editor.load().catch(() => undefined)
    }
  }
  if (session.loggedIn && editor.status !== 'ready') {
    await editor.load().catch(() => undefined)
  }
  if (bookmarks.status === 'idle') {
    await bookmarks.load(readPublicSlug()).catch(() => undefined)
  }
})

function openDetails(item: MangaItem) {
  selectedManga.value = item
  detailsOpen.value = true
}

function openAdd() {
  if (!session.loggedIn && mode.kind !== 'local') {
    showLoginAlert.value = true
    return
  }
  editingManga.value = null
  editorOpen.value = true
}

function openEdit(item: MangaItem) {
  if (!session.loggedIn && mode.kind !== 'local') {
    showLoginAlert.value = true
    return
  }
  editingManga.value = { ...item }
  editorOpen.value = true
}

function handleSave(item: MangaItem) {
  actionError.value = ''
  if (selectedManga.value && selectedManga.value.id === item.id) {
    selectedManga.value = item
  }
}

async function handleStep(item: MangaItem, delta: number) {
  if (!session.loggedIn && mode.kind !== 'local') {
    showLoginAlert.value = true
    return
  }
  actionError.value = ''
  try {
    await stepChapter(item.id, delta)
    if (selectedManga.value && selectedManga.value.id === item.id) {
      selectedManga.value.currentChapter += delta
    }
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : t.mangaSaveFailed
  }
}

async function handleUpdateChapter(item: MangaItem, chapter: number, overrideUrl?: string) {
  if (!session.loggedIn && mode.kind !== 'local') {
    showLoginAlert.value = true
    return
  }
  actionError.value = ''
  try {
    await updateChapter(item.id, chapter, overrideUrl)
    if (selectedManga.value && selectedManga.value.id === item.id) {
      selectedManga.value.currentChapter = chapter
      selectedManga.value.latestUrl = overrideUrl
    }
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : t.mangaSaveFailed
  }
}

async function handleDelete(item: MangaItem) {
  if (!session.loggedIn && mode.kind !== 'local') {
    showLoginAlert.value = true
    return
  }
  actionError.value = ''
  try {
    await removeManga(item.id)
    if (selectedManga.value?.id === item.id) {
      selectedManga.value = null
    }
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : t.mangaSaveFailed
  }
}
</script>

<template>
  <main class="relative mx-auto flex min-h-svh w-full max-w-md flex-col px-4 pb-16 pt-2 sm:max-w-3xl sm:px-6 lg:max-w-6xl lg:px-8">
    <AppNavbar />

    <!-- Page Title & Stats -->
    <div class="mb-6 flex items-center justify-between">
      <div>
        <div class="flex items-center gap-2.5">
          <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{{ t.manga }}</h1>
          <span class="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-semibold">
            {{ mangaList.length }}
          </span>
        </div>
        <p class="mt-1 text-xs sm:text-sm text-muted-foreground">{{ t.mangaSubtitle }}</p>
      </div>
    </div>

    <!-- Visitor Notice Banner -->
    <div
      v-if="!session.loggedIn && mode.kind !== 'local' && session.status === 'ready'"
      class="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-primary-wash p-4 text-xs sm:text-sm text-foreground shadow-xs"
    >
      <div class="flex items-center gap-2.5">
        <span class="inline-flex size-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
        <p class="leading-relaxed">{{ t.mangaVisitorNotice }}</p>
      </div>
      <Button as-child class="h-9 px-4 rounded-full text-xs sm:text-sm font-medium shrink-0 shadow-xs">
        <RouterLink to="/settings">{{ t.login }}</RouterLink>
      </Button>
    </div>

    <!-- Error Banner if action failed -->
    <div
      v-if="actionError"
      class="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs sm:text-sm text-destructive shadow-xs"
    >
      <span>{{ actionError }}</span>
      <Button size="sm" variant="ghost" class="h-6 px-2 text-xs" @click="actionError = ''">
        &times;
      </Button>
    </div>

    <!-- Search & Action Bar -->
    <div class="mb-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
      <div class="relative flex-1 max-w-lg">
        <Search class="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          v-model="searchQuery"
          class="h-12 pl-11 pr-4 text-sm sm:text-base rounded-full bg-card shadow-sm border-border/80 focus-visible:ring-2"
          :placeholder="t.mangaSearchPlaceholder"
        />
      </div>

      <div class="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
        <span class="text-sm font-medium text-muted-foreground px-1">
          {{ filteredManga.length }} เรื่อง
        </span>

        <Button class="h-12 px-6 rounded-full text-sm sm:text-base font-semibold shadow-sm hover:shadow-md transition-all gap-2" @click="openAdd">
          <Plus class="size-5" />
          {{ t.mangaAdd }}
        </Button>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-if="!filteredManga.length"
      class="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/40 p-12 sm:p-16 text-center"
    >
      <div class="flex size-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-4 shadow-xs">
        <BookOpen class="size-8" />
      </div>
      <h3 class="text-lg font-semibold text-foreground">{{ t.mangaEmpty }}</h3>
      <p class="mt-1.5 max-w-sm text-xs sm:text-sm text-muted-foreground leading-relaxed">
        {{ t.mangaEmptyHint }}
      </p>
      <Button class="mt-6 h-11 px-6 rounded-full text-sm font-semibold shadow-sm gap-2" @click="openAdd">
        <Plus class="size-4.5" />
        {{ t.mangaAdd }}
      </Button>
    </div>

    <!-- Responsive Poster Grid (1 to 3 columns) -->
    <div
      v-else
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7 lg:gap-8"
    >
      <MangaCard
        v-for="item in filteredManga"
        :key="item.id"
        :manga="item"
        @click="openDetails"
        @step="handleStep"
      />
    </div>

    <!-- Details Dialog -->
    <MangaDetailsDialog
      v-model:open="detailsOpen"
      :manga="selectedManga"
      @update-chapter="handleUpdateChapter"
      @edit="openEdit"
      @delete="handleDelete"
    />

    <!-- Editor Dialog -->
    <MangaEditorDialog
      v-model:open="editorOpen"
      :manga="editingManga"
      @save="handleSave"
    />

    <!-- Login Required Alert Dialog -->
    <AlertDialog :open="showLoginAlert" @update:open="(val: boolean) => (showLoginAlert = val)">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t.mangaNeedLogin }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ t.mangaVisitorNotice }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ t.cancel }}</AlertDialogCancel>
          <AlertDialogAction as-child>
            <RouterLink to="/settings">{{ t.login }}</RouterLink>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </main>
</template>
