<script setup lang="ts">
import { Crop, ImagePlus, Minus, Plus, Sparkles, Upload } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

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
import { useManga } from '@/composables/useManga'
import { t } from '@/i18n/th'
import {
  detectChapterPattern,
  resolveChapterUrl,
  type MangaItem,
} from '@/lib/manga'
import { useModeStore } from '@/stores/mode'
import { useSessionStore } from '@/stores/session'

const props = defineProps<{
  open: boolean
  manga?: MangaItem | null
  saveHandler?: (item: MangaItem) => Promise<void>
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'save', item: MangaItem): void
}>()

const { saveManga } = useManga()
const session = useSessionStore()
const mode = useModeStore()

const title = ref('')
const currentChapter = ref<number>(1)
const urlPattern = ref('')
const latestUrl = ref('')
const coverUrl = ref('')
const note = ref('')
const errors = ref<{ title?: string; pattern?: string }>({})
const saving = ref(false)
const saveError = ref('')

// Cropper state
const cropOpen = ref(false)
const rawImageSrc = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      saving.value = false
      saveError.value = ''
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

async function handleSave() {
  if (!validate()) return

  saving.value = true
  saveError.value = ''

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

  try {
    if (props.saveHandler) {
      await props.saveHandler(item)
    } else {
      await saveManga(item)
    }
    emit('save', item)
    emit('update:open', false)
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : t.mangaSaveFailed
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="(val: boolean) => emit('update:open', val)">
    <DialogContent
      class="sm:max-w-xl md:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl"
      @paste="handlePaste"
    >
      <DialogHeader class="px-6 sm:px-8 pt-7 pb-4 shrink-0 border-b border-border/60 bg-muted/10">
        <DialogTitle class="text-xl font-bold tracking-tight">
          {{ isEditing ? t.mangaEdit : t.mangaAdd }}
        </DialogTitle>
      </DialogHeader>

      <form class="flex-1 overflow-y-auto px-6 sm:px-8 py-6 space-y-6" @submit.prevent="handleSave">
        <!-- Title -->
        <div>
          <label class="block text-sm font-semibold text-foreground">
            {{ t.mangaTitle }} <span class="text-destructive">*</span>
          </label>
          <Input
            v-model="title"
            class="mt-2 h-11 text-sm rounded-xl"
            placeholder="e.g. Solo Leveling หรือ Revenge of the Iron-Blooded Sword Hound"
            autocomplete="off"
          />
          <p v-if="errors.title" class="mt-1.5 text-xs text-destructive font-medium">{{ errors.title }}</p>
        </div>

        <!-- URL Pattern & Auto Detect -->
        <div>
          <div class="flex items-center justify-between">
            <label class="block text-sm font-semibold text-foreground">
              {{ t.mangaUrlPattern }}
            </label>
            <Button
              v-if="urlPattern"
              type="button"
              variant="ghost"
              size="sm"
              class="h-7 text-xs font-medium text-primary hover:text-primary rounded-lg"
              @click="runAutoDetect"
            >
              <Sparkles class="mr-1.5 size-3.5" />
              {{ t.mangaAutoDetect }}
            </Button>
          </div>
          <Input
            v-model="urlPattern"
            class="mt-2 h-10 font-mono text-xs rounded-xl"
            placeholder="https://www.go-manga.com/series-ตอนที่-{chapter}/"
            autocomplete="off"
            @blur="runAutoDetect"
          />
          <p class="mt-1.5 text-xs text-muted-foreground leading-relaxed">
            {{ t.mangaUrlPatternHint }}
          </p>
        </div>

        <!-- Current Chapter Stepper -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label class="block text-sm font-semibold text-foreground">
              {{ t.mangaCurrentChapter }}
            </label>
            <div class="mt-2 flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                class="size-11 shrink-0 rounded-xl"
                :disabled="currentChapter <= 1"
                @click="stepChapter(-1)"
              >
                <Minus class="size-4" />
              </Button>
              <Input
                v-model.number="currentChapter"
                type="number"
                min="1"
                class="h-11 text-center font-bold text-base rounded-xl"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                class="size-11 shrink-0 rounded-xl"
                @click="stepChapter(1)"
              >
                <Plus class="size-4" />
              </Button>
            </div>
          </div>

          <!-- Optional Override URL -->
          <div>
            <label class="block text-sm font-semibold text-foreground">
              {{ t.mangaOverrideUrl }}
            </label>
            <Input
              v-model="latestUrl"
              class="mt-2 h-11 font-mono text-xs rounded-xl"
              placeholder="https://... (ทางเลือก)"
              autocomplete="off"
            />
            <p class="mt-1.5 text-[11px] text-muted-foreground leading-relaxed">
              {{ t.mangaOverrideUrlHint }}
            </p>
          </div>
        </div>

        <!-- Resolved URL Preview -->
        <div v-if="computedSampleUrl" class="rounded-xl bg-muted/40 p-3.5 text-xs border border-border/60">
          <span class="font-medium text-muted-foreground">{{ t.mangaReadNow }} {{ currentChapter }}: </span>
          <span class="font-mono text-foreground break-all font-semibold">{{ computedSampleUrl }}</span>
        </div>

        <!-- Cover Image Section -->
        <div>
          <label class="block text-sm font-semibold text-foreground mb-2">
            {{ t.mangaCover }}
          </label>

          <div class="flex flex-col sm:flex-row items-start gap-5">
            <!-- Cover Preview -->
            <div
              class="relative flex w-28 h-40 sm:w-32 sm:h-44 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-muted/40 shadow-xs"
            >
              <img
                v-if="coverUrl"
                :src="coverUrl"
                alt="Cover"
                class="size-full object-cover"
              />
              <div v-else class="flex flex-col items-center gap-1.5 p-3 text-center text-muted-foreground">
                <ImagePlus class="size-7 stroke-[1.5]" />
                <span class="text-[11px] font-medium leading-tight">2:3 Poster</span>
              </div>
            </div>

            <!-- Upload / Paste Actions -->
            <div class="flex-1 space-y-3 w-full">
              <input
                ref="fileInputRef"
                type="file"
                accept="image/*"
                class="hidden"
                @change="onFileSelect"
              />

              <div class="flex flex-wrap gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  class="h-9 px-3.5 rounded-xl text-xs font-medium gap-1.5"
                  @click="fileInputRef?.click()"
                >
                  <Upload class="size-3.5" />
                  {{ t.mangaCoverUpload }}
                </Button>

                <Button
                  v-if="coverUrl"
                  type="button"
                  variant="outline"
                  size="sm"
                  class="h-9 px-3.5 rounded-xl text-xs font-medium gap-1.5"
                  @click="rawImageSrc = coverUrl; cropOpen = true"
                >
                  <Crop class="size-3.5" />
                  {{ t.mangaCoverCrop }}
                </Button>

                <Button
                  v-if="coverUrl"
                  type="button"
                  variant="ghost"
                  size="sm"
                  class="h-9 px-3 text-xs rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                  @click="coverUrl = ''"
                >
                  {{ t.delete }}
                </Button>
              </div>

              <!-- Direct URL or Paste hint -->
              <Input
                v-model="coverUrl"
                class="h-10 font-mono text-xs rounded-xl"
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
          <label class="block text-sm font-semibold text-foreground">
            {{ t.mangaNote }}
          </label>
          <Textarea
            v-model="note"
            class="mt-2 min-h-24 p-3 text-xs sm:text-sm rounded-xl"
            placeholder="เรื่องย่อ หรือบันทึกเพิ่มเติม..."
          />
        </div>
      </form>

      <div v-if="saveError" class="px-6 sm:px-8 py-3 bg-destructive/10 border-t border-destructive/20 text-xs sm:text-sm text-destructive flex items-center justify-between gap-3">
        <span>{{ saveError }}</span>
        <Button
          v-if="!session.loggedIn && mode.kind !== 'local'"
          as-child
          size="sm"
          variant="destructive"
          class="h-8 px-3 text-xs rounded-lg font-medium"
        >
          <RouterLink to="/settings">{{ t.login }}</RouterLink>
        </Button>
      </div>

      <DialogFooter class="px-6 sm:px-8 py-4.5 shrink-0 border-t border-border/60 flex items-center justify-end gap-3 bg-muted/15">
        <Button variant="outline" type="button" class="h-10 px-5 text-sm font-medium rounded-xl" :disabled="saving" @click="emit('update:open', false)">
          {{ t.cancel }}
        </Button>
        <Button type="button" class="h-10 px-6 text-sm font-semibold rounded-xl shadow-xs" :disabled="saving" @click="handleSave">
          <span v-if="saving" class="flex items-center gap-2">
            <span class="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            {{ t.mangaSaving }}
          </span>
          <span v-else>{{ t.save }}</span>
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
