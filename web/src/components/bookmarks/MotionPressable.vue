<script setup lang="ts">
import { computed } from 'vue'
import { Motion } from 'motion-v'

import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    href?: string
    local?: boolean
    lift?: boolean
    class?: string
  }>(),
  {
    lift: true,
  },
)

const external = computed(() => !!props.href && !props.local)
const hover = computed(() => (props.lift ? { y: -2 } : undefined))

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()
</script>

<template>
  <Motion
    class="block"
    :while-hover="hover"
    :while-tap="{ scale: 0.98 }"
    :transition="{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }"
  >
    <a
      v-if="href"
      :href="href"
      :target="external ? '_blank' : undefined"
      :rel="external ? 'noopener noreferrer' : undefined"
      :class="
        cn(
          'relative block rounded-xl border border-border bg-card text-card-foreground shadow-sm outline-none',
          'transition-[background-color,border-color,box-shadow,color] duration-200',
          'hover:border-ring/40 hover:bg-card-hover hover:shadow-md',
          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'active:shadow-sm',
          props.class,
        )
      "
      @click="emit('click', $event)"
    >
      <slot />
    </a>
    <div
      v-else
      :class="
        cn(
          'relative block rounded-xl border border-border bg-card text-card-foreground shadow-sm outline-none',
          'transition-[background-color,border-color,box-shadow,color] duration-200',
          'hover:border-ring/40 hover:bg-card-hover hover:shadow-md',
          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          props.class,
        )
      "
      @click="emit('click', $event)"
    >
      <slot />
    </div>
  </Motion>
</template>
