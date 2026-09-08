<script setup lang="ts">
import { ref, watch } from 'vue'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { t } from '@/i18n/th'
import { useEditorStore } from '@/stores/editor'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const editor = useEditorStore()
const label = ref('')
const encrypted = ref(false)

watch(
  () => props.open,
  (open) => {
    if (open) {
      label.value = ''
      encrypted.value = false
    }
  },
)

function create() {
  if (!label.value.trim()) return
  editor.addSection(label.value.trim(), encrypted.value)
  emit('update:open', false)
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-md p-6">
      <DialogHeader>
        <DialogTitle class="text-lg font-semibold">{{ t.addSection }}</DialogTitle>
      </DialogHeader>
      <div class="space-y-4 py-2 text-sm">
        <label class="block">
          <span class="text-xs font-medium text-foreground">{{ t.sectionLabel }}</span>
          <Input v-model="label" class="mt-1.5" placeholder="e.g. 🛠️ Dev Tools" />
        </label>
        <label class="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer">
          <input v-model="encrypted" type="checkbox" class="size-4 rounded border-input text-primary focus:ring-ring cursor-pointer" />
          <span>{{ t.sectionEncrypt }}</span>
        </label>
      </div>
      <DialogFooter class="gap-2 sm:gap-2">
        <Button variant="outline" @click="emit('update:open', false)">{{ t.cancel }}</Button>
        <Button :disabled="!label.trim()" @click="create">{{ t.save }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
