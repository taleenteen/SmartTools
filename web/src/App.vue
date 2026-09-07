<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { MotionConfig } from 'motion-v'

import ThemeChrome from '@/components/bookmarks/ThemeChrome.vue'
import { useThemeStore } from '@/stores/theme'

const theme = useThemeStore()

onMounted(() => {
  theme.hydrateFromUrl()
})
</script>

<template>
  <MotionConfig reduced-motion="user">
    <ThemeChrome />
    <RouterView />
  </MotionConfig>
</template>
