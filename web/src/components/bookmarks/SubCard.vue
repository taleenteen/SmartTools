<script setup lang="ts">
import { computed } from 'vue'

import BookmarkIcon from '@/components/bookmarks/BookmarkIcon.vue'
import MotionPressable from '@/components/bookmarks/MotionPressable.vue'
import { effectiveComment } from '@/lib/comment-overrides'
import { openHref } from '@/lib/resolve-url'
import { useUiStore } from '@/stores/ui'
import type { SubCard as SubCardModel } from '@/types/bookmark'

const props = defineProps<{
  item: SubCardModel
  cardId: string
  encrypted?: boolean
}>()

const ui = useUiStore()
const compact = computed(() => props.item.content !== undefined)
const href = computed(() => openHref(props.item.url, props.item.isLocal))

function onClick(event: MouseEvent) {
  const comment = effectiveComment(props.item, props.cardId)
  if (!comment) return
  event.preventDefault()
  ui.openNote({
    cardId: props.cardId,
    card: props.item,
    href: href.value,
    encrypted: props.encrypted,
  })
}
</script>

<template>
  <MotionPressable :href="href" :local="item.isLocal" class="p-2.5" @click="onClick">
    <div v-if="compact" class="flex items-center gap-2.5">
      <BookmarkIcon :icon="item.icon" :icon-img="item.iconImg" size="sm" />
      <div class="min-w-0">
        <p class="truncate text-sm font-medium">{{ item.content }}</p>
        <p v-if="item.note" class="truncate text-[11px] text-muted-foreground">{{ item.note }}</p>
      </div>
    </div>
    <div v-else class="flex flex-col gap-1">
      <div class="flex items-center gap-2.5">
        <BookmarkIcon :icon="item.icon" :icon-img="item.iconImg" size="sm" />
        <h4 class="truncate text-sm font-semibold">{{ item.title }}</h4>
      </div>
      <p v-if="item.desc" class="truncate pl-10 text-xs text-muted-foreground">{{ item.desc }}</p>
    </div>
  </MotionPressable>
</template>
