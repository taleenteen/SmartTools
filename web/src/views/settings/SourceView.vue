<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { t } from '@/i18n/th'
import { getSource, setSource } from '@/lib/api'

const current = ref<'kv' | 'static'>('kv')
const error = ref('')

onMounted(() => {
  void getSource()
    .then((value) => {
      current.value = value
    })
    .catch(() => {
      error.value = t.saveFailed
    })
})

async function choose(source: 'kv' | 'static') {
  error.value = ''
  await setSource(source)
  current.value = source
}
</script>

<template>
  <div class="grid gap-3 sm:grid-cols-2">
    <button
      type="button"
      class="rounded-xl border p-4 text-left transition-colors hover:bg-card-hover focus-visible:ring-2 focus-visible:ring-ring"
      :class="current === 'kv' ? 'border-primary bg-primary-wash' : 'border-border bg-card'"
      @click="choose('kv')"
    >
      <p class="font-semibold">{{ t.sourceKv }}</p>
      <p class="mt-1 text-sm text-muted-foreground">{{ t.sourceKvHint }}</p>
      <p v-if="current === 'kv'" class="mt-2 text-xs text-primary">{{ t.sourceCurrent }}</p>
    </button>
    <button
      type="button"
      class="rounded-xl border p-4 text-left transition-colors hover:bg-card-hover focus-visible:ring-2 focus-visible:ring-ring"
      :class="current === 'static' ? 'border-primary bg-primary-wash' : 'border-border bg-card'"
      @click="choose('static')"
    >
      <p class="font-semibold">{{ t.sourceStatic }}</p>
      <p class="mt-1 text-sm text-muted-foreground">{{ t.sourceStaticHint }}</p>
      <p v-if="current === 'static'" class="mt-2 text-xs text-primary">{{ t.sourceCurrent }}</p>
    </button>
    <p v-if="error" class="text-sm text-destructive sm:col-span-2">{{ error }}</p>
  </div>
</template>
