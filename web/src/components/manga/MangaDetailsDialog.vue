<script setup lang="ts">
import { BookOpen, ExternalLink, Minus, Pencil, Plus, Trash2 } from '@lucide/vue'
import { computed, ref, watch } from 'vue'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
import { resolveChapterUrl, type MangaItem } from '@/lib/manga'
import { useModeStore } from '@/stores/mode'
import { useSessionStore } from '@/stores/session'

const props = defineProps<{
  open: boolean
  manga: MangaItem | null
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'update-chapter', manga: MangaItem, chapter: number, overrideUrl?: string): void
  (e: 'edit', manga: MangaItem): void
  (e: 'delete', manga: MangaItem): void
}>()

const session = useSessionStore()
const mode = useModeStore()

const draftChapter = ref<number>(1)
const draftOverrideUrl = ref('')
const showOverride = ref(false)
const confirmDeleteOpen = ref(false)

watch(
  () => props.manga,
  (item) => {
    if (item) {
      draftChapter.value = item.currentChapter || 1
      draftOverrideUrl.value = item.latestUrl || ''
      showOverride.value = !!item.latestUrl
    }
  },
  { immediate: true },
)

const currentUrl = computed(() => {
  if (!props.manga) return ''
  return props.manga.latestUrl || resolveChapterUrl(props.manga.urlPattern, props.manga.currentChapter)
})

const nextChapterUrl = computed(() => {
  if (!props.manga) return ''
  return resolveChapterUrl(props.manga.urlPattern, draftChapter.value + 1)
})

const previewUrlForDraft = computed(() => {
  if (!props.manga) return ''
  return resolveChapterUrl(props.manga.urlPattern, draftChapter.value, draftOverrideUrl.value)
})

const isDirty = computed(() => {
  if (!props.manga) return false
  return (
    draftChapter.value !== props.manga.currentChapter ||
    draftOverrideUrl.value !== (props.manga.latestUrl || '')
  )
})

function stepDraft(delta: number) {
  draftChapter.value = Math.max(1, draftChapter.value + delta)
}

function openCurrentLink() {
  if (currentUrl.value) {
    window.open(currentUrl.value, '_blank', 'noopener,noreferrer')
  }
}

function openNextLink() {
  if (nextChapterUrl.value) {
    window.open(nextChapterUrl.value, '_blank', 'noopener,noreferrer')
    // Auto advance chapter when clicking next
    draftChapter.value += 1
    handleSaveProgress()
  }
}

function handleSaveProgress() {
  if (!props.manga) return
  emit(
    'update-chapter',
    props.manga,
    draftChapter.value,
    draftOverrideUrl.value.trim() || undefined,
  )
  emit('update:open', false)
}

function confirmDelete() {
  if (props.manga) {
    emit('delete', props.manga)
    emit('update:open', false)
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="(val: boolean) => emit('update:open', val)">
    <DialogContent class="sm:max-w-md md:max-w-lg p-0 overflow-hidden">
      <DialogHeader class="sr-only">
        <DialogTitle>{{ manga?.title || t.mangaDetails }}</DialogTitle>
      </DialogHeader>
      <div v-if="manga" class="flex flex-col">
        <!-- Top Media Section -->
        <div class="relative flex gap-4 p-6 bg-muted/20 border-b border-border">
          <!-- Cover Thumbnail -->
          <div
            class="relative aspect-[2/3] w-24 shrink-0 overflow-hidden rounded-xl border border-border bg-muted shadow-sm"
          >
            <img
              v-if="manga.coverUrl"
              :src="manga.coverUrl"
              :alt="manga.title"
              class="size-full object-cover"
            />
            <div v-else class="flex size-full items-center justify-center bg-secondary/40 text-muted-foreground">
              <BookOpen class="size-6" />
            </div>
          </div>

          <!-- Title & Meta -->
          <div class="flex flex-1 flex-col justify-between min-w-0">
            <div>
              <div class="flex items-start justify-between gap-2">
                <span
                  class="inline-flex items-center rounded-md bg-primary-wash px-2 py-0.5 text-xs font-semibold text-primary"
                >
                  {{ t.mangaChapter }} {{ manga.currentChapter }}
                </span>

                <div class="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    class="size-7 text-muted-foreground hover:text-foreground"
                    :title="t.edit"
                    @click="emit('edit', manga); emit('update:open', false)"
                  >
                    <Pencil class="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    class="size-7 text-muted-foreground hover:text-destructive"
                    :title="t.delete"
                    @click="confirmDeleteOpen = true"
                  >
                    <Trash2 class="size-3.5" />
                  </Button>
                </div>
              </div>

              <h2 class="mt-1.5 text-base sm:text-lg font-semibold tracking-tight text-foreground line-clamp-2">
                {{ manga.title }}
              </h2>

              <p v-if="manga.note" class="mt-1 text-xs text-muted-foreground line-clamp-2">
                {{ manga.note }}
              </p>
            </div>

            <!-- Read Current Chapter Button -->
            <div class="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                class="rounded-full shadow-xs"
                :disabled="!currentUrl"
                @click="openCurrentLink"
              >
                <ExternalLink class="mr-1.5 size-3.5" />
                {{ t.mangaReadNow }} {{ manga.currentChapter }}
              </Button>

              <Button
                v-if="nextChapterUrl"
                size="sm"
                variant="outline"
                class="rounded-full"
                @click="openNextLink"
              >
                {{ t.mangaNextChapter }} ({{ manga.currentChapter + 1 }})
              </Button>
            </div>
          </div>
        </div>

        <!-- Chapter Progress Stepper & Update -->
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              {{ t.mangaCurrentChapter }}
            </label>
            <div class="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                class="size-10 shrink-0 rounded-xl"
                :disabled="draftChapter <= 1"
                @click="stepDraft(-1)"
              >
                <Minus class="size-4" />
              </Button>

              <Input
                v-model.number="draftChapter"
                type="number"
                min="1"
                class="h-10 text-center font-bold text-base rounded-xl"
              />

              <Button
                type="button"
                variant="outline"
                size="icon"
                class="size-10 shrink-0 rounded-xl"
                @click="stepDraft(1)"
              >
                <Plus class="size-4" />
              </Button>
            </div>
          </div>

          <!-- URL Preview -->
          <div class="rounded-xl border border-border bg-muted/30 p-3 text-xs">
            <p class="font-medium text-muted-foreground">{{ t.mangaUrlPattern }}:</p>
            <p class="mt-0.5 font-mono text-foreground break-all text-[11px]">
              {{ previewUrlForDraft || t.folderDisconnected }}
            </p>
          </div>

          <!-- Optional Custom URL toggle -->
          <div>
            <button
              type="button"
              class="text-xs text-primary underline-offset-4 hover:underline"
              @click="showOverride = !showOverride"
            >
              {{ showOverride ? 'ซ่อนการระบุ URL เฉพาะตอน' : t.mangaOverrideUrl }}
            </button>

            <div v-if="showOverride" class="mt-2 space-y-1">
              <Input
                v-model="draftOverrideUrl"
                class="font-mono text-xs"
                placeholder="https://... (URL สำหรับตอนนี้เท่านั้น)"
              />
              <p class="text-[11px] text-muted-foreground">
                {{ t.mangaOverrideUrlHint }}
              </p>
            </div>
          </div>
        </div>

        <!-- Footer Actions -->
        <DialogFooter class="p-4 shrink-0 border-t border-border flex flex-wrap items-center justify-between gap-2 bg-muted/10">
          <div class="text-xs text-muted-foreground">
            <span v-if="!session.loggedIn && mode.kind !== 'local'" class="text-amber-600 dark:text-amber-400 font-medium">
              {{ t.mangaNeedLogin }}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <Button variant="outline" type="button" @click="emit('update:open', false)">
              {{ t.cancel }}
            </Button>
            <Button
              type="button"
              :disabled="!isDirty || (!session.loggedIn && mode.kind !== 'local')"
              @click="handleSaveProgress"
            >
              {{ t.save }}
            </Button>
          </div>
        </DialogFooter>
      </div>
    </DialogContent>
  </Dialog>

  <!-- Delete Confirmation -->
  <AlertDialog :open="confirmDeleteOpen" @update:open="(val: boolean) => confirmDeleteOpen = val">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t.mangaDelete }}</AlertDialogTitle>
        <AlertDialogDescription>{{ t.mangaDeleteConfirm }}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ t.cancel }}</AlertDialogCancel>
        <AlertDialogAction
          class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          @click="confirmDelete"
        >
          {{ t.delete }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
