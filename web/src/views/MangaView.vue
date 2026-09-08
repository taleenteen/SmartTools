<script setup lang="ts">
import { BookOpen, Plus, Search } from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

import ThemeSwitcher from '@/components/bookmarks/ThemeSwitcher.vue'
import MangaCard from '@/components/manga/MangaCard.vue'
import MangaDetailsDialog from '@/components/manga/MangaDetailsDialog.vue'
import MangaEditorDialog from '@/components/manga/MangaEditorDialog.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useManga } from '@/composables/useManga'
import { t } from '@/i18n/th'
import { readPublicSlug } from '@/lib/public-slug'
import { useBookmarksStore } from '@/stores/bookmarks'
import { useEditorStore } from '@/stores/editor'
import { useSessionStore } from '@/stores/session'
import type { MangaItem } from '@/lib/manga'

const bookmarks = useBookmarksStore()
const editor = useEditorStore()
const session = useSessionStore()
const { mangaList, saveManga, stepChapter, updateChapter, removeManga } = useManga()

const searchQuery = ref('')
const selectedManga = ref<MangaItem | null>(null)
const detailsOpen = ref(false)
const editorOpen = ref(false)
const editingManga = ref<MangaItem | null>(null)

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
  if (bookmarks.status === 'idle') {
    await bookmarks.load(readPublicSlug()).catch(() => undefined)
  }
  if (session.loggedIn && editor.status === 'idle') {
    await editor.load().catch(() => undefined)
  }
})

function openDetails(item: MangaItem) {
  selectedManga.value = item
  detailsOpen.value = true
}

function openAdd() {
  editingManga.value = null
  editorOpen.value = true
}

function openEdit(item: MangaItem) {
  editingManga.value = { ...item }
  editorOpen.value = true
}

async function handleSave(item: MangaItem) {
  await saveManga(item)
  if (selectedManga.value && selectedManga.value.id === item.id) {
    selectedManga.value = item
  }
}

async function handleStep(item: MangaItem, delta: number) {
  await stepChapter(item.id, delta)
  if (selectedManga.value && selectedManga.value.id === item.id) {
    selectedManga.value.currentChapter += delta
  }
}

async function handleUpdateChapter(item: MangaItem, chapter: number, overrideUrl?: string) {
  await updateChapter(item.id, chapter, overrideUrl)
  if (selectedManga.value && selectedManga.value.id === item.id) {
    selectedManga.value.currentChapter = chapter
    selectedManga.value.latestUrl = overrideUrl
  }
}

async function handleDelete(item: MangaItem) {
  await removeManga(item.id)
  if (selectedManga.value?.id === item.id) {
    selectedManga.value = null
  }
}
</script>

<template>
  <main class="relative mx-auto flex min-h-svh w-full max-w-md flex-col px-4 pb-16 pt-10 sm:max-w-3xl sm:px-6 lg:max-w-6xl lg:px-8">
    <!-- Header -->
    <header class="mb-8 flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="text-sm text-muted-foreground">{{ t.appName }}</p>
        <h1 class="text-2xl font-semibold tracking-tight text-foreground">{{ t.manga }}</h1>
        <p class="mt-1 text-xs text-muted-foreground">{{ t.mangaSubtitle }}</p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <Button as-child size="sm" variant="outline" class="rounded-full">
          <RouterLink to="/">{{ t.bookmarks }}</RouterLink>
        </Button>
        <Button as-child size="sm" variant="outline" class="rounded-full">
          <RouterLink to="/t">{{ t.tools }}</RouterLink>
        </Button>
        <Button
          v-if="session.loggedIn"
          as-child
          size="sm"
          class="rounded-full"
        >
          <RouterLink to="/settings">{{ t.settings }}</RouterLink>
        </Button>
        <ThemeSwitcher />
      </div>
    </header>

    <!-- Search & Action Bar -->
    <div class="mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
      <div class="relative flex-1 max-w-md">
        <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          v-model="searchQuery"
          class="h-10 pl-9 rounded-full bg-card shadow-xs"
          :placeholder="t.mangaSearchPlaceholder"
        />
      </div>

      <div class="flex items-center justify-between sm:justify-end gap-3">
        <span class="text-xs text-muted-foreground">
          {{ filteredManga.length }} เรื่อง
        </span>

        <Button size="sm" class="rounded-full shadow-xs" @click="openAdd">
          <Plus class="mr-1.5 size-3.5" />
          {{ t.mangaAdd }}
        </Button>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-if="!filteredManga.length"
      class="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/40 p-12 text-center"
    >
      <div class="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-4">
        <BookOpen class="size-7" />
      </div>
      <h3 class="text-base font-semibold text-foreground">{{ t.mangaEmpty }}</h3>
      <p class="mt-1 max-w-sm text-xs text-muted-foreground">
        {{ t.mangaEmptyHint }}
      </p>
      <Button size="sm" class="mt-5 rounded-full" @click="openAdd">
        <Plus class="mr-1.5 size-3.5" />
        {{ t.mangaAdd }}
      </Button>
    </div>

    <!-- Responsive Poster Grid (2 to 6 columns) -->
    <div
      v-else
      class="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
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
  </main>
</template>
