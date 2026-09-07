<script setup lang="ts">
import { Skeleton } from '@/components/ui/skeleton'
</script>

<template>
  <div class="space-y-6">
    <div v-for="block in 3" :key="block" class="space-y-3">
      <Skeleton class="h-4 w-28" />
      <div class="space-y-2.5">
        <Skeleton v-for="card in 3" :key="card" class="h-[72px] w-full rounded-xl" />
      </div>
    </div>
  </div>
</template>
