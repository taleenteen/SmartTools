<script setup lang="ts">
import { Crop, ImagePlus, Minus, Plus, Sparkles, Upload } from '@lucide/vue'
import { computed, ref, watch } from 'vue'

import ImageCropDialog from '@/components/manga/ImageCropDialog.vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { t } from '@/i18n/th'
import {
  detectChapterPattern,
  resolveChapterUrl,
  type MangaItem,
} from '@/lib/manga'

const props = defineProps<{
  open: boolean
  manga?: MangaItem | null
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'save', item: MangaItem): void
}>()

const title = ref('')
const currentChapter = ref<number>(1)
const urlPattern = ref('')
const latestUrl = ref('')
const coverUrl = ref('')
const note = ref('')
const errors = ref<{ title?: string; pattern?: string }>({})

// Cropper state
const cropOpen = ref(false)
const rawImageSrc = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      if (props.manga) {
        title.value = props.manga.title
        currentChapter.value = props.manga.currentChapter || 1
        urlPattern.value = props.manga.urlPattern
        latestUrl.value = props.manga.latestUrl || ''
        coverUrl.value = props.manga.coverUrl || ''
        note.value = props.manga.note || ''
      } else {
        title.value = ''
        currentChapter.value = 1
        urlPattern.value = ''
        latestUrl.value = ''
        coverUrl.value = ''
        note.value = ''
      }
      errors.value = {}
    }
  },
)

const isEditing = computed(() => !!props.manga?.id)

const computedSampleUrl = computed(() => {
  if (!urlPattern.value) return ''
  return resolveChapterUrl(urlPattern.value, currentChapter.value, latestUrl.value)
})

function runAutoDetect() {
  if (!urlPattern.value.trim()) return
  const result = detectChapterPattern(urlPattern.value)
  urlPattern.value = result.pattern
  if (!props.manga && result.detectedChapter > 1) {
    currentChapter.value = result.detectedChapter
  }
}

function handlePaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item && item.type.startsWith('image/')) {
      e.preventDefault()
      const file = item.getAsFile()
      if (file) {
        processImageFile(file)
      }
      break
    }
  }
}

function onFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    processImageFile(file)
  }
  target.value = ''
}

function processImageFile(file: File) {
  const reader = new FileReader()
  reader.onload = (e) => {
    const result = e.target?.result
    if (typeof result === 'string') {
      rawImageSrc.value = result
      cropOpen.value = true
    }
  }
  reader.readAsDataURL(file)
}

function onCropped(dataUrl: string) {
  coverUrl.value = dataUrl
}

function stepChapter(delta: number) {
  currentChapter.value = Math.max(1, currentChapter.value + delta)
}

function validate(): boolean {
  errors.value = {}
  if (!title.value.trim()) {
    errors.value.title = t.titleRequired
    return false
  }
  return true
}

function handleSave() {
  if (!validate()) return

  const item: MangaItem = {
    id: props.manga?.id || `manga_${Math.random().toString(36).slice(2, 9)}`,
    title: title.value.trim(),
    currentChapter: Math.max(1, currentChapter.value),
    urlPattern: urlPattern.value.trim(),
    latestUrl: latestUrl.value.trim() || undefined,
    coverUrl: coverUrl.value.trim(),
    note: note.value.trim(),
    updatedAt: new Date().toISOString(),
  }

  emit('save', item)
  emit('update:open', false)
}
</script>

<template>
  <Dialog :open="open" @update:open="(val: boolean) => emit('update:open', val)">
    <DialogContent
      class="sm:max-w-xl md:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden"
      @paste="handlePaste"
    >
      <DialogHeader class="px-6 pt-6 pb-2 shrink-0 border-b border-border/50">
        <DialogTitle class="text-xl font-semibold tracking-tight">
          {{ isEditing ? t.mangaEdit : t.mangaAdd }}
        </DialogTitle>
      </DialogHeader>

      <form class="flex-1 overflow-y-auto px-6 py-4 space-y-4" @submit.prevent="handleSave">
        <!-- Title -->
        <div>
          <label class="block text-sm font-medium text-foreground">
            {{ t.mangaTitle }} <span class="text-destructive">*</span>
          </label>
          <Input
            v-model="title"
            class="mt-1"
            placeholder="e.g. Revenge of the Iron-Blooded Sword Hound"
            autocomplete="off"
          />
          <p v-if="errors.title" class="mt-1 text-xs text-destructive">{{ errors.title }}</p>
        </div>

        <!-- URL Pattern & Auto Detect -->
        <div>
          <div class="flex items-center justify-between">
            <label class="block text-sm font-medium text-foreground">
              {{ t.mangaUrlPattern }}
            </label>
            <Button
              v-if="urlPattern"
              type="button"
              variant="ghost"
              size="sm"
              class="h-7 text-xs text-primary hover:text-primary"
              @click="runAutoDetect"
            >
              <Sparkles class="mr-1 size-3" />
              {{ t.mangaAutoDetect }}
            </Button>
          </div>
          <Input
            v-model="urlPattern"
            class="mt-1 font-mono text-xs"
            placeholder="https://www.go-manga.com/series-ตอนที่-{chapter}/"
            autocomplete="off"
            @blur="runAutoDetect"
          />
          <p class="mt-1 text-xs text-muted-foreground">
            {{ t.mangaUrlPatternHint }}
          </p>
        </div>

        <!-- Current Chapter Stepper -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-foreground">
              {{ t.mangaCurrentChapter }}
            </label>
            <div class="mt-1 flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="icon"
                class="size-9 shrink-0"
                :disabled="currentChapter <= 1"
                @click="stepChapter(-1)"
              >
                <Minus class="size-4" />
              </Button>
              <Input
                v-model.number="currentChapter"
                type="number"
                min="1"
                class="text-center font-semibold"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                class="size-9 shrink-0"
                @click="stepChapter(1)"
              >
                <Plus class="size-4" />
              </Button>
            </div>
          </div>

          <!-- Optional Override URL -->
          <div>
            <label class="block text-sm font-medium text-foreground">
              {{ t.mangaOverrideUrl }}
            </label>
            <Input
              v-model="latestUrl"
              class="mt-1 font-mono text-xs"
              placeholder="https://..."
              autocomplete="off"
            />
            <p class="mt-1 text-[11px] text-muted-foreground">
              {{ t.mangaOverrideUrlHint }}
            </p>
          </div>
        </div>

        <!-- Resolved URL Preview -->
        <div v-if="computedSampleUrl" class="rounded-lg bg-muted/50 p-2.5 text-xs">
          <span class="text-muted-foreground">{{ t.mangaReadNow }} {{ currentChapter }}: </span>
          <span class="font-mono text-foreground break-all">{{ computedSampleUrl }}</span>
        </div>

        <!-- Cover Image Section -->
        <div>
          <label class="block text-sm font-medium text-foreground mb-1.5">
            {{ t.mangaCover }}
          </label>

          <div class="flex flex-col sm:flex-row items-start gap-4">
            <!-- Cover Preview -->
            <div
              class="relative flex size-28 sm:w-28 sm:h-40 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/40 shadow-xs"
            >
              <img
                v-if="coverUrl"
                :src="coverUrl"
                alt="Cover"
                class="size-full object-cover"
              />
              <div v-else class="flex flex-col items-center gap-1 p-2 text-center text-muted-foreground">
                <ImagePlus class="size-6 stroke-[1.5]" />
                <span class="text-[10px] leading-tight">2:3 Ratio</span>
              </div>
            </div>

            <!-- Upload / Paste Actions -->
            <div class="flex-1 space-y-2 w-full">
              <input
                ref="fileInputRef"
                type="file"
                accept="image/*"
                class="hidden"
                @change="onFileSelect"
              />

              <div class="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  class="rounded-full"
                  @click="fileInputRef?.click()"
                >
                  <Upload class="mr-1.5 size-3.5" />
                  {{ t.mangaCoverUpload }}
                </Button>

                <Button
                  v-if="coverUrl"
                  type="button"
                  variant="outline"
                  size="sm"
                  class="rounded-full"
                  @click="rawImageSrc = coverUrl; cropOpen = true"
                >
                  <Crop class="mr-1.5 size-3.5" />
                  {{ t.mangaCoverCrop }}
                </Button>

                <Button
                  v-if="coverUrl"
                  type="button"
                  variant="ghost"
                  size="sm"
                  class="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                  @click="coverUrl = ''"
                >
                  {{ t.delete }}
                </Button>
              </div>

              <!-- Direct URL or Paste hint -->
              <Input
                v-model="coverUrl"
                class="font-mono text-xs"
                placeholder="Image URL or data:image/..."
              />

              <p class="text-xs text-muted-foreground">
                {{ t.mangaCoverPasteHint }}
              </p>
            </div>
          </div>
        </div>

        <!-- Note / Synopsis -->
        <div>
          <label class="block text-sm font-medium text-foreground">
            {{ t.mangaNote }}
          </label>
          <Textarea
            v-model="note"
            class="mt-1 min-h-16 text-xs"
            placeholder="เรื่องย่อ หรือบันทึกเพิ่มเติม..."
          />
        </div>
      </form>

      <DialogFooter class="px-6 py-4 shrink-0 border-t border-border/50 flex items-center justify-end gap-2 bg-muted/10">
        <Button variant="outline" type="button" @click="emit('update:open', false)">
          {{ t.cancel }}
        </Button>
        <Button type="button" @click="handleSave">
          {{ t.save }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Interactive Canvas Crop Modal -->
  <ImageCropDialog
    v-model:open="cropOpen"
    :image-src="rawImageSrc"
    @crop="onCropped"
  />
</template>
