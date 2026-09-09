<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Motion } from 'motion-v'

import AppNavbar from '@/components/bookmarks/AppNavbar.vue'
import BookmarkCardSkeleton from '@/components/bookmarks/BookmarkCardSkeleton.vue'
import EmailRow from '@/components/bookmarks/EmailRow.vue'
import LockFab from '@/components/bookmarks/LockFab.vue'
import NoteDialog from '@/components/bookmarks/NoteDialog.vue'
import QuickSearchBar from '@/components/bookmarks/QuickSearchBar.vue'
import SectionBlock from '@/components/bookmarks/SectionBlock.vue'
import StatusPanels from '@/components/bookmarks/StatusPanels.vue'
import UnlockDialog from '@/components/bookmarks/UnlockDialog.vue'
import { t } from '@/i18n/th'
import { isEncryptedLocked } from '@/lib/normalize-sections'
import { readPublicSlug } from '@/lib/public-slug'
import { useBookmarksStore } from '@/stores/bookmarks'
import { useEncryptStore } from '@/stores/encrypt'
import { useUiStore } from '@/stores/ui'
import { useViewerStore } from '@/stores/viewer'
import type { BookmarkSection } from '@/types/bookmark'

const bookmarks = useBookmarksStore()
const viewer = useViewerStore()
const ui = useUiStore()
const encrypt = useEncryptStore()

const searchQuery = ref('')
const hasSearch = computed(() => searchQuery.value.trim().length > 0)

const cardSections = computed(() => bookmarks.visibleSections.filter((section) => section.kind === 'card'))
const emailSection = computed(() => bookmarks.visibleSections.find((section) => section.kind === 'email'))
const contactSection = computed(() => bookmarks.visibleSections.find((section) => section.kind === 'contact'))

const filteredCardSections = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return cardSections.value
  return cardSections.value
    .map((section) => {
      if (isEncryptedLocked(section)) {
        return section.label.toLowerCase().includes(q) ? section : null
      }
      const matchingCards = section.cards.filter(
        (c) =>
          (c.title && c.title.toLowerCase().includes(q)) ||
          (c.desc && c.desc.toLowerCase().includes(q)) ||
          (c.descClickable && c.descClickable.toLowerCase().includes(q)) ||
          (c.url && c.url.toLowerCase().includes(q)) ||
          (c.comment && c.comment.toLowerCase().includes(q)),
      )
      if (!matchingCards.length) return null
      return {
        ...section,
        cards: matchingCards,
      }
    })
    .filter((s): s is BookmarkSection => s !== null)
})

const filteredEmailSection = computed(() => {
  if (!hasSearch.value) return emailSection.value
  const q = searchQuery.value.trim().toLowerCase()
  if (!emailSection.value) return undefined
  const matchingCards = emailSection.value.cards.filter(
    (c) =>
      (c.title && c.title.toLowerCase().includes(q)) ||
      (c.mailto && c.mailto.toLowerCase().includes(q)) ||
      (c.address && c.address.toLowerCase().includes(q)),
  )
  if (!matchingCards.length) return undefined
  return { ...emailSection.value, cards: matchingCards }
})

const filteredContactSection = computed(() => {
  if (!hasSearch.value) return contactSection.value
  const q = searchQuery.value.trim().toLowerCase()
  if (!contactSection.value) return undefined
  const matchingCards = contactSection.value.cards.filter(
    (c) =>
      (c.title && c.title.toLowerCase().includes(q)) ||
      (c.address && c.address.toLowerCase().includes(q)),
  )
  if (!matchingCards.length) return undefined
  return { ...contactSection.value, cards: matchingCards }
})

const hasSearchResults = computed(
  () => filteredCardSections.value.length > 0 || !!filteredEmailSection.value || !!filteredContactSection.value,
)

async function refresh() {
  const payload = await bookmarks.load(readPublicSlug())
  viewer.apply(payload.viewer)
  await encrypt.bootstrap()
}

onMounted(() => {
  void refresh().catch(() => undefined)
})
</script>

<template>
  <div
    v-if="ui.overlayOpen"
    class="fixed inset-0 z-20 bg-overlay"
    @click="ui.collapse()"
  />
  <main class="relative mx-auto flex min-h-svh w-full max-w-md flex-col px-4 pb-16 pt-2 sm:max-w-3xl sm:px-6 lg:max-w-6xl lg:px-8">
    <AppNavbar />

    <div class="mb-6 flex items-center justify-between">
      <div>
        <div class="flex items-center gap-2.5">
          <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{{ t.bookmarks }}</h1>
          <span v-if="bookmarks.status === 'ready'" class="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-semibold">
            {{ cardSections.reduce((acc, s) => acc + s.cards.length, 0) }}
          </span>
        </div>
        <p v-if="viewer.slug || viewer.username" class="mt-1 text-xs text-muted-foreground">
          {{ viewer.slug || viewer.username }}
        </p>
      </div>
    </div>

    <div v-if="bookmarks.status === 'ready'" class="mb-8">
      <QuickSearchBar v-model="searchQuery" />
    </div>

    <BookmarkCardSkeleton v-if="bookmarks.status === 'loading' || bookmarks.status === 'idle'" />

    <StatusPanels
      v-else-if="bookmarks.status === 'error'"
      :title="t.loadErrorTitle"
      :body="bookmarks.error || t.loadErrorBody"
      :action-label="t.retry"
      @retry="refresh"
    />

    <StatusPanels
      v-else-if="!cardSections.length && !emailSection && !contactSection"
      :title="t.emptyTitle"
      :body="t.emptyBody"
    />

    <StatusPanels
      v-else-if="hasSearch && !hasSearchResults"
      :title="t.searchEmptyTitle"
      :body="t.searchEmptyBody"
      :action-label="t.clearSearch"
      @retry="searchQuery = ''"
    />

    <Motion
      v-else
      class="flex flex-col gap-8"
      :initial="'hidden'"
      :animate="'show'"
      :variants="{
        hidden: {},
        show: { transition: { staggerChildren: 0.04 } },
      }"
    >
      <Motion
        v-for="section in filteredCardSections"
        :key="section.key"
        :variants="{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }"
        :transition="{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }"
      >
        <SectionBlock :section="section" :filter-query="searchQuery" />
      </Motion>
      <EmailRow :email="filteredEmailSection" :contact="filteredContactSection" />
    </Motion>
    <UnlockDialog />
    <NoteDialog />
    <LockFab />
  </main>
</template>
