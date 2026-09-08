<script setup lang="ts">
import { Search, X } from '@lucide/vue'
import { onMounted, onUnmounted, ref } from 'vue'

import { t } from '@/i18n/th'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const inputRef = ref<HTMLInputElement | null>(null)

function onKeyDown(event: KeyboardEvent) {
  if (
    (event.key === '/' || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k')) &&
    document.activeElement !== inputRef.value &&
    !['INPUT', 'TEXTAREA', 'SELECT'].includes((document.activeElement?.tagName || ''))
  ) {
    event.preventDefault()
    inputRef.value?.focus()
  } else if (event.key === 'Escape' && document.activeElement === inputRef.value) {
    if (props.modelValue) {
      emit('update:modelValue', '')
    } else {
      inputRef.value?.blur()
    }
  }
}

onMounted(() => window.addEventListener('keydown', onKeyDown))
onUnmounted(() => window.removeEventListener('keydown', onKeyDown))

function clear() {
  emit('update:modelValue', '')
  inputRef.value?.focus()
}
</script>

<template>
  <div class="relative w-full">
    <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-muted-foreground">
      <Search class="size-4" aria-hidden="true" />
    </div>
    <input
      ref="inputRef"
      type="search"
      :value="modelValue"
      :placeholder="t.searchPlaceholder"
      class="border-input h-10 w-full rounded-xl border bg-card/80 py-2 pr-16 pl-10 text-sm text-foreground placeholder:text-muted-foreground shadow-xs backdrop-blur-xs transition-[border-color,box-shadow] focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      aria-label="Search bookmarks"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <div class="absolute inset-y-0 right-0 flex items-center pr-2.5">
      <button
        v-if="modelValue"
        type="button"
        class="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        :aria-label="t.clearSearch"
        @click="clear"
      >
        <X class="size-3.5" />
      </button>
      <kbd
        v-else
        class="pointer-events-none hidden items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex"
      >
        /
      </kbd>
    </div>
  </div>
</template>
