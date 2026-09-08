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
    class="group relative flex flex-col overflow-hidden rounded-3xl border border-border/80 bg-card shadow-sm transition-all duration-300 hover:border-ring/50 hover:shadow-xl hover:-translate-y-1 cursor-pointer select-none"
    @click="emit('click', manga)"
  >
    <!-- Poster Container (2:3 Aspect Ratio) -->
    <div class="relative aspect-[2/3] w-full overflow-hidden bg-muted/60">
      <img
        v-if="manga.coverUrl"
        :src="manga.coverUrl"
        :alt="manga.title"
        class="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
        loading="lazy"
      />
      <div
        v-else
        class="flex size-full flex-col items-center justify-center gap-2 p-4 text-center text-muted-foreground bg-secondary/30"
      >
        <BookOpen class="size-10 stroke-[1.5] text-muted-foreground/60" />
        <span class="line-clamp-2 text-sm font-medium">{{ manga.title }}</span>
      </div>

      <!-- Top-right Chapter Badge -->
      <div class="absolute right-3 top-3 z-10">
        <span
          class="inline-flex items-center rounded-xl bg-background/90 px-3 py-1 text-xs sm:text-sm font-bold text-foreground shadow-md backdrop-blur-md border border-border/60 tracking-tight"
        >
          {{ t.mangaChapter }} {{ manga.currentChapter }}
        </span>
      </div>

      <!-- Subtle bottom gradient for poster edge -->
      <div class="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/25 to-transparent" />
    </div>

    <!-- Generous Footer & Metadata Area -->
    <div class="flex flex-1 flex-col justify-between p-4 sm:p-5 gap-3.5 bg-card">
      <div>
        <h3
          class="line-clamp-2 text-base sm:text-lg font-bold text-foreground group-hover:text-primary transition-colors leading-snug tracking-tight"
          :title="manga.title"
        >
          {{ manga.title }}
        </h3>
        <p v-if="manga.note" class="mt-1.5 line-clamp-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
          {{ manga.note }}
        </p>
      </div>

      <!-- Bottom Quick Actions Row with Comfortable Breathing Room -->
      <div class="flex items-center justify-between gap-2 pt-3 border-t border-border/60">
        <!-- Read Link Button -->
        <Button
          size="sm"
          variant="secondary"
          class="h-9 px-3.5 rounded-xl text-xs sm:text-sm font-medium gap-1.5 shadow-xs hover:bg-secondary/80 transition-colors"
          :title="`${t.mangaReadNow} ${manga.currentChapter}`"
          @click="openChapter"
        >
          <ExternalLink class="size-3.5" />
          {{ t.mangaRead }}
        </Button>

        <!-- Quick +1 Chapter Button -->
        <Button
          size="sm"
          variant="default"
          class="h-9 px-3.5 rounded-xl text-xs sm:text-sm font-bold gap-1 shadow-xs hover:opacity-90 transition-opacity"
          :title="t.mangaQuickStep"
          @click="handleStep($event, 1)"
        >
          <Plus class="size-4" />
          1
        </Button>
      </div>
    </div>
  </div>
</template>
