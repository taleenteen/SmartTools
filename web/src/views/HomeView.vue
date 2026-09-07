<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { Motion } from 'motion-v'

import AppHeader from '@/components/bookmarks/AppHeader.vue'
import BookmarkCardSkeleton from '@/components/bookmarks/BookmarkCardSkeleton.vue'
import EmailRow from '@/components/bookmarks/EmailRow.vue'
import LockFab from '@/components/bookmarks/LockFab.vue'
import NoteDialog from '@/components/bookmarks/NoteDialog.vue'
import SectionBlock from '@/components/bookmarks/SectionBlock.vue'
import StatusPanels from '@/components/bookmarks/StatusPanels.vue'
import UnlockDialog from '@/components/bookmarks/UnlockDialog.vue'
import { t } from '@/i18n/th'
import { readPublicSlug } from '@/lib/public-slug'
import { useBookmarksStore } from '@/stores/bookmarks'
import { useEncryptStore } from '@/stores/encrypt'
import { useUiStore } from '@/stores/ui'
import { useViewerStore } from '@/stores/viewer'

const bookmarks = useBookmarksStore()
const viewer = useViewerStore()
const ui = useUiStore()
const encrypt = useEncryptStore()

const cardSections = computed(() => bookmarks.visibleSections.filter((section) => section.kind === 'card'))
const emailSection = computed(() => bookmarks.visibleSections.find((section) => section.kind === 'email'))
const contactSection = computed(() => bookmarks.visibleSections.find((section) => section.kind === 'contact'))

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
  <main class="relative mx-auto flex min-h-svh w-full max-w-md flex-col px-5 pb-16 pt-14 md:max-w-2xl">
    <AppHeader />

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
        v-for="section in cardSections"
        :key="section.key"
        :variants="{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }"
        :transition="{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }"
      >
        <SectionBlock :section="section" />
      </Motion>
      <EmailRow :email="emailSection" :contact="contactSection" />
    </Motion>
    <UnlockDialog />
    <NoteDialog />
    <LockFab />
  </main>
</template>
