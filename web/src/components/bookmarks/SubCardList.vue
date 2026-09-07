<script setup lang="ts">
import { AnimatePresence, Motion } from 'motion-v'

import SubCard from '@/components/bookmarks/SubCard.vue'
import type { SubCard as SubCardModel } from '@/types/bookmark'

defineProps<{
  open: boolean
  items: SubCardModel[]
  parentId: string
  encrypted?: boolean
}>()
</script>

<template>
  <AnimatePresence>
    <Motion
      v-if="open && items.length"
      class="mt-2 flex flex-col gap-2 overflow-hidden"
      :initial="{ opacity: 0, height: 0 }"
      :animate="{ opacity: 1, height: 'auto' }"
      :exit="{ opacity: 0, height: 0 }"
      :transition="{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }"
    >
      <SubCard
        v-for="(item, index) in items"
        :key="item.id || item.url || index"
        :item="item"
        :card-id="item.id || `${parentId}-sub-${index}`"
        :encrypted="encrypted"
      />
    </Motion>
  </AnimatePresence>
</template>
