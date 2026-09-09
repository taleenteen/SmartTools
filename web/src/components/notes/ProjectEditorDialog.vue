<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { t } from '@/i18n/th'
import type { NoteProject } from '@/types/note'
import { FolderPlus, Image, Sparkles } from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
  project?: NoteProject | null
  saving?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'save', project: Partial<NoteProject>): void
}>()

const title = ref('')
const description = ref('')
const coverUrl = ref('')
const color = ref('blue')

const colors = [
  { id: 'blue', label: 'Blue', class: 'bg-blue-500' },
  { id: 'indigo', label: 'Indigo', class: 'bg-indigo-500' },
  { id: 'violet', label: 'Violet', class: 'bg-purple-500' },
  { id: 'emerald', label: 'Emerald', class: 'bg-emerald-500' },
  { id: 'amber', label: 'Amber', class: 'bg-amber-500' },
  { id: 'rose', label: 'Rose', class: 'bg-rose-500' },
]

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      if (props.project) {
        title.value = props.project.title
        description.value = props.project.description || ''
        coverUrl.value = props.project.coverUrl || ''
        color.value = props.project.color || 'blue'
      } else {
        title.value = ''
        description.value = ''
        coverUrl.value = ''
        color.value = 'blue'
      }
    }
  }
)

function handleClose() {
  emit('update:open', false)
}

function handleSave() {
  if (!title.value.trim()) return
  emit('save', {
    id: props.project?.id,
    title: title.value.trim(),
    description: description.value.trim(),
    coverUrl: coverUrl.value.trim(),
    color: color.value,
  })
}
</script>

<template>
  <Dialog :open="open" @update:open="(val) => emit('update:open', val)">
    <DialogContent class="sm:max-w-md p-6 sm:p-8 rounded-2xl shadow-xl">
      <DialogHeader class="space-y-2">
        <div class="flex items-center gap-3">
          <div class="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <FolderPlus class="size-5" />
          </div>
          <div>
            <DialogTitle class="text-xl font-bold text-foreground">
              {{ project ? t.notesEditProject : t.notesNewProject }}
            </DialogTitle>
            <DialogDescription class="text-xs sm:text-sm text-muted-foreground">
              {{ t.notesSubtitle }}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <form @submit.prevent="handleSave" class="space-y-4 my-2">
        <!-- Title -->
        <div class="space-y-1.5">
          <label class="text-sm font-semibold text-foreground flex items-center justify-between">
            <span>{{ t.notesTitle }} <span class="text-destructive">*</span></span>
          </label>
          <Input
            v-model="title"
            :placeholder="t.notesProjectNamePlaceholder"
            required
            class="h-11 rounded-xl shadow-xs text-sm"
          />
        </div>

        <!-- Description -->
        <div class="space-y-1.5">
          <label class="text-sm font-semibold text-foreground">
            {{ t.cardDesc }}
          </label>
          <Textarea
            v-model="description"
            :placeholder="t.notesProjectDescPlaceholder"
            rows="2"
            class="rounded-xl shadow-xs text-sm resize-none"
          />
        </div>

        <!-- Color theme picker -->
        <div class="space-y-2">
          <label class="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Sparkles class="size-4 text-muted-foreground" />
            <span>สีประจำโฟลเดอร์</span>
          </label>
          <div class="flex items-center gap-3">
            <button
              v-for="c in colors"
              :key="c.id"
              type="button"
              :class="[
                'size-8 rounded-full transition-transform flex items-center justify-center',
                c.class,
                color === c.id ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'opacity-80 hover:opacity-100'
              ]"
              @click="color = c.id"
            />
          </div>
        </div>

        <!-- Optional Cover Image -->
        <div class="space-y-1.5">
          <label class="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Image class="size-4 text-muted-foreground" />
            <span>{{ t.notesCover }}</span>
          </label>
          <Input
            v-model="coverUrl"
            :placeholder="t.notesCoverPlaceholder"
            class="h-11 rounded-xl shadow-xs text-sm"
          />
          <div v-if="coverUrl" class="mt-2 h-28 rounded-xl overflow-hidden border border-border relative bg-muted/40">
            <img :src="coverUrl" class="w-full h-full object-cover" alt="Cover Preview" />
          </div>
        </div>

        <DialogFooter class="pt-4 flex items-center justify-end gap-2.5">
          <Button type="button" variant="outline" class="h-11 px-5 rounded-xl text-sm" @click="handleClose">
            {{ t.cancel }}
          </Button>
          <Button
            type="submit"
            class="h-11 px-6 rounded-xl text-sm font-semibold shadow-xs"
            :disabled="!title.trim() || saving"
          >
            {{ saving ? t.notesSaving : t.save }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
