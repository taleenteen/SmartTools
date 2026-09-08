<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Motion } from 'motion-v'

import BookmarkCard from '@/components/bookmarks/BookmarkCard.vue'
import { t } from '@/i18n/th'
import { cardIdentity, detectLayout, isEncryptedLocked, visibleCountFor } from '@/lib/normalize-sections'
import { useEncryptStore } from '@/stores/encrypt'
import type { BookmarkSection } from '@/types/bookmark'

const props = withDefaults(
  defineProps<{
    section: BookmarkSection
    filterQuery?: string
  }>(),
  {
    filterQuery: '',
  },
)

const layout = ref(detectLayout())
const expanded = ref(false)

function onResize() {
  layout.value = detectLayout()
}

onMounted(() => window.addEventListener('resize', onResize))
onUnmounted(() => window.removeEventListener('resize', onResize))

const encrypt = useEncryptStore()
const locked = computed(() => isEncryptedLocked(props.section))
const cap = computed(() => visibleCountFor(props.section, layout.value))
const shown = computed(() => {
  if (props.filterQuery || !props.section.dynamic || expanded.value) return props.section.cards
  return props.section.cards.slice(0, cap.value)
})
const hiddenCount = computed(() => {
  if (props.filterQuery) return 0
  return Math.max(0, props.section.cards.length - shown.value.length)
})

function toggle() {
  expanded.value = !expanded.value
}
</script>

<template>
  <section v-if="locked" class="py-2">
    <button
      type="button"
      class="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-ring hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      @click="encrypt.openDialog()"
    >
      🔒 {{ t.lockedPill }}
    </button>
  </section>
  <section v-else :id="section.anchor || section.key" class="space-y-3">
    <h2 class="text-sm font-semibold tracking-wide text-foreground">{{ section.label }}</h2>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 items-start">
      <BookmarkCard
        v-for="(card, index) in shown"
        :key="cardIdentity(card, `${section.key}-${index}`)"
        :card="card"
        :card-id="cardIdentity(card, `${section.key}-${index}`)"
        :encrypted="section.encrypted"
      />
    </div>
    <button
      v-if="!filterQuery && (hiddenCount > 0 || (section.dynamic && expanded))"
      type="button"
      class="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      @click="toggle"
    >
      <Motion :animate="{ rotate: expanded ? 180 : 0 }" :transition="{ duration: 0.18 }">
        <ChevronDown class="size-3.5" />
      </Motion>
      {{ expanded ? t.showLess : t.showMoreCount(hiddenCount) }}
    </button>
  </section>
</template>
