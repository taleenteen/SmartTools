<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  icon?: string
  iconImg?: string
  size?: 'sm' | 'md'
}>()

const isSvg = computed(() => !!props.icon?.trim().startsWith('<svg'))
</script>

<template>
  <span
    class="flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary-wash text-lg leading-none"
    :class="size === 'sm' ? 'size-8 text-base' : 'size-10'"
    aria-hidden="true"
  >
    <img v-if="iconImg" :src="iconImg" alt="" class="size-full object-contain" />
    <!-- SVG icons come from trusted data.js / KV, not free-form user HTML. -->
    <span v-else-if="isSvg" class="size-full [&_svg]:size-full" v-html="icon" />
    <span v-else>{{ icon || '🔗' }}</span>
  </span>
</template>
