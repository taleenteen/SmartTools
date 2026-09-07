<script setup lang="ts">
import { t } from '@/i18n/th'
import { isEncryptedLocked } from '@/lib/normalize-sections'
import { useEditorStore } from '@/stores/editor'

const editor = useEditorStore()
const emit = defineEmits<{
  manage: []
}>()
</script>

<template>
  <div class="mb-4 flex flex-wrap gap-2">
    <button
      v-for="section in editor.sections"
      :key="section.key"
      type="button"
      class="rounded-full border px-3 py-1 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring"
      :class="
        section.key === editor.activeKey
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-foreground hover:bg-card-hover'
      "
      @click="editor.setActive(section.key)"
    >
      <span v-if="section.encrypted">🔒 </span>
      {{ section.label }}
      <span v-if="isEncryptedLocked(section)" class="opacity-70"> · {{ t.unlock }}</span>
    </button>
    <button
      type="button"
      class="rounded-full border border-dashed border-border px-3 py-1 text-sm text-muted-foreground hover:text-foreground"
      @click="emit('manage')"
    >
      {{ t.addSection }}
    </button>
  </div>
</template>
