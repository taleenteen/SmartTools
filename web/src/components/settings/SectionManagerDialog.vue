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
    <DialogContent class="max-w-sm">
      <DialogHeader>
        <DialogTitle>{{ t.addSection }}</DialogTitle>
      </DialogHeader>
      <label class="block text-sm">
        {{ t.sectionLabel }}
        <Input v-model="label" class="mt-1" />
      </label>
      <label class="mt-3 flex items-center gap-2 text-sm">
        <input v-model="encrypted" type="checkbox" />
        {{ t.sectionEncrypt }}
      </label>
      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)">{{ t.cancel }}</Button>
        <Button :disabled="!label.trim()" @click="create">{{ t.save }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
