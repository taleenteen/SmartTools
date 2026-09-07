<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import { computed } from 'vue'
import { Motion } from 'motion-v'

import BookmarkIcon from '@/components/bookmarks/BookmarkIcon.vue'
import MotionPressable from '@/components/bookmarks/MotionPressable.vue'
import SubCardList from '@/components/bookmarks/SubCardList.vue'
import { t } from '@/i18n/th'
import { effectiveComment } from '@/lib/comment-overrides'
import { openHref } from '@/lib/resolve-url'
import { useUiStore } from '@/stores/ui'
import type { BookmarkCard as Card } from '@/types/bookmark'

const props = defineProps<{
  card: Card
  cardId: string
  encrypted?: boolean
}>()

const ui = useUiStore()
const expanded = computed(() => ui.expandedCardId === props.cardId)
const href = computed(() => openHref(props.card.url, props.card.isLocal))
const descHref = computed(() => openHref(props.card.descUrl, false))
const isExpandable = computed(() => props.card.type === 'expandable')
const isDescClickable = computed(
  () => props.card.type === 'desc-clickable' || (!!props.card.descClickable && !!props.card.descUrl),
)

function onExpand(event: Event) {
  event.preventDefault()
  event.stopPropagation()
  ui.toggleExpanded(props.cardId)
}

function onDescClick(event: MouseEvent) {
  if (!descHref.value) return
  event.preventDefault()
  event.stopPropagation()
  window.open(descHref.value, '_blank', 'noopener,noreferrer')
}

function onCardClick(event: MouseEvent) {
  const comment = effectiveComment(props.card, props.cardId)
  if (!comment) return
  event.preventDefault()
  ui.openNote({
    cardId: props.cardId,
    card: props.card,
    href: href.value,
    encrypted: props.encrypted,
  })
}
</script>

<template>
  <div class="relative" :class="expanded ? 'z-30' : 'z-0'">
    <MotionPressable
      :href="href"
      :local="card.isLocal"
      :class="isExpandable ? 'pr-12' : undefined"
      @click="onCardClick"
    >
      <div class="flex items-start gap-3 p-3.5">
        <BookmarkIcon :icon="card.icon" :icon-img="card.iconImg" />
        <div class="min-w-0 flex-1">
          <h3 class="truncate text-sm font-semibold text-foreground">
            {{ card.title }}
          </h3>
          <p
            v-if="isDescClickable && card.descClickable"
            class="mt-0.5 truncate text-xs text-primary underline-offset-2 hover:underline"
            @click="onDescClick"
          >
            {{ card.descClickable }}
          </p>
          <p v-else-if="card.desc" class="mt-0.5 truncate text-xs text-muted-foreground">
            {{ card.desc }}
          </p>
        </div>
      </div>
      <button
        v-if="isExpandable"
        type="button"
        class="absolute top-0 right-0 flex h-full w-11 items-center justify-center rounded-r-xl text-muted-foreground transition-colors hover:bg-primary-wash hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
        :aria-expanded="expanded"
        :aria-label="t.toggleLinks"
        @click="onExpand"
      >
        <Motion :animate="{ rotate: expanded ? 180 : 0 }" :transition="{ duration: 0.18 }">
          <ChevronDown class="size-4" />
        </Motion>
      </button>
    </MotionPressable>
    <SubCardList
      v-if="isExpandable"
      :open="expanded"
      :items="card.subCards ?? []"
      :parent-id="cardId"
      :encrypted="encrypted"
    />
  </div>
</template>
