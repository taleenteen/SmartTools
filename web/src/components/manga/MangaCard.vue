<script setup lang="ts">
import { BookOpen, ExternalLink, Plus } from '@lucide/vue'

import { Button } from '@/components/ui/button'
import { t } from '@/i18n/th'
import { resolveChapterUrl, type MangaItem } from '@/lib/manga'

const props = defineProps<{
  manga: MangaItem
}>()

const emit = defineEmits<{
  (e: 'click', manga: MangaItem): void
  (e: 'step', manga: MangaItem, delta: number): void
}>()

function openChapter(e: MouseEvent) {
  e.stopPropagation()
  const targetUrl = props.manga.latestUrl || resolveChapterUrl(props.manga.urlPattern, props.manga.currentChapter)
  if (targetUrl) {
    window.open(targetUrl, '_blank', 'noopener,noreferrer')
  }
}

function handleStep(e: MouseEvent, delta: number) {
  e.stopPropagation()
  emit('step', props.manga, delta)
}
</script>

<template>
  <div
    class="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xs transition-all duration-200 hover:border-ring/40 hover:shadow-md cursor-pointer select-none"
    @click="emit('click', manga)"
  >
    <!-- Poster Container (2:3 Aspect Ratio) -->
    <div class="relative aspect-[2/3] w-full overflow-hidden bg-muted/60">
      <img
        v-if="manga.coverUrl"
        :src="manga.coverUrl"
        :alt="manga.title"
        class="size-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
        loading="lazy"
      />
      <div
        v-else
        class="flex size-full flex-col items-center justify-center gap-2 p-4 text-center text-muted-foreground bg-secondary/30"
      >
        <BookOpen class="size-8 stroke-[1.5] text-muted-foreground/60" />
        <span class="line-clamp-2 text-xs font-medium">{{ manga.title }}</span>
      </div>

      <!-- Top-right Chapter Badge -->
      <div class="absolute right-2 top-2 z-10">
        <span
          class="inline-flex items-center rounded-lg bg-background/85 px-2 py-0.5 text-xs font-semibold text-foreground shadow-sm backdrop-blur-md border border-border/60"
        >
          {{ t.mangaChapter }} {{ manga.currentChapter }}
        </span>
      </div>

      <!-- Quick Action Floating Overlay on hover (bottom of poster) -->
      <div
        class="absolute inset-x-0 bottom-0 flex items-center justify-between p-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-6 opacity-90 sm:opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      >
        <!-- Read Link Button -->
        <Button
          size="sm"
          variant="secondary"
          class="h-7 rounded-lg px-2 text-xs font-medium bg-background/90 text-foreground hover:bg-background shadow-xs"
          :title="`${t.mangaReadNow} ${manga.currentChapter}`"
          @click="openChapter"
        >
          <ExternalLink class="mr-1 size-3" />
          {{ t.mangaRead }}
        </Button>

        <!-- Quick +1 Chapter Button -->
        <Button
          size="sm"
          variant="default"
          class="h-7 rounded-lg px-2 text-xs font-medium shadow-xs"
          :title="t.mangaQuickStep"
          @click="handleStep($event, 1)"
        >
          <Plus class="mr-0.5 size-3" />
          1
        </Button>
      </div>
    </div>

    <!-- Title & Subtitle Below Poster -->
    <div class="flex flex-col p-2.5">
      <h3
        class="line-clamp-2 text-xs sm:text-sm font-semibold text-foreground group-hover:text-primary transition-colors leading-snug"
        :title="manga.title"
      >
        {{ manga.title }}
      </h3>
      <p v-if="manga.note" class="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
        {{ manga.note }}
      </p>
    </div>
  </div>
</template>
