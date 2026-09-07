<script setup lang="ts">
import { Button } from '@/components/ui/button'

defineProps<{
  title: string
  body: string
  actionLabel?: string
}>()

const emit = defineEmits<{
  retry: []
}>()
</script>

<template>
  <div class="rounded-xl border border-border bg-card p-6 text-center shadow-sm">
    <h2 class="text-base font-semibold text-foreground">{{ title }}</h2>
    <p class="mt-2 text-sm text-muted-foreground">{{ body }}</p>
    <Button v-if="actionLabel" class="mt-4 rounded-full" size="sm" @click="emit('retry')">
      {{ actionLabel }}
    </Button>
  </div>
</template>
