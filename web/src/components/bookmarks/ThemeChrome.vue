<script setup lang="ts">
import { computed } from 'vue'

import { useThemeStore } from '@/stores/theme'

const theme = useThemeStore()

const showStripeBar = computed(() => theme.id === 'stripe')
</script>

<template>
  <div class="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
    <div
      v-if="showStripeBar"
      class="absolute inset-x-0 top-0 h-0.5 bg-linear-to-r from-primary via-accent to-primary"
    />
  </div>
</template>
