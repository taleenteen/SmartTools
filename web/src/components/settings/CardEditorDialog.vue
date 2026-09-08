<script setup lang="ts">
import { ChevronDown, Plus, Trash2 } from '@lucide/vue'
import { computed, reactive, ref, watch } from 'vue'

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
import type { BookmarkCard, CardType, SubCard } from '@/types/bookmark'

const props = defineProps<{
  open: boolean
  card: BookmarkCard | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  save: [card: BookmarkCard]
}>()

const showAdvanced = ref(false)
const submitted = ref(false)

const draft = reactive<BookmarkCard>({
  title: '',
  type: 'simple',
  url: '',
  desc: '',
  descClickable: '',
  descUrl: '',
  icon: '',
  iconImg: '',
  comment: '',
  isLocal: false,
  id: '',
  subCards: [],
})

const iconKind = computed(() => {
  if (draft.iconImg) return 'img'
  if (draft.icon?.trim().startsWith('<svg')) return 'svg'
  return 'emoji'
})

watch(
  () => [props.open, props.card] as const,
  ([open, card]) => {
    if (!open) return
    submitted.value = false
    showAdvanced.value = Boolean(card?.comment || card?.isLocal || card?.descClickable || card?.descUrl)
    Object.assign(draft, {
      title: '',
      type: 'simple' as CardType,
      url: '',
      desc: '',
      descClickable: '',
      descUrl: '',
      icon: '',
      iconImg: '',
      comment: '',
      isLocal: false,
      id: '',
      ...card,
      subCards: card?.subCards ? card.subCards.map((item) => ({ ...item })) : [],
    })
  },
)

function setKind(kind: 'emoji' | 'img' | 'svg') {
  if (kind === 'img') {
    draft.icon = ''
  } else {
    draft.iconImg = ''
  }
}

function addSub() {
  draft.subCards = [...(draft.subCards || []), { title: '', url: '' }]
}

function removeSub(index: number) {
  draft.subCards = (draft.subCards || []).filter((_, i) => i !== index)
}

function patchSub(index: number, patch: Partial<SubCard>) {
  draft.subCards = (draft.subCards || []).map((item, i) => (i === index ? { ...item, ...patch } : item))
}

function submit() {
  submitted.value = true
  if (!draft.title?.trim()) return
  emit('save', { ...draft, subCards: draft.type === 'expandable' ? draft.subCards : undefined })
  emit('update:open', false)
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-h-[90vh] max-w-lg overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{{ card ? t.edit : t.addCard }}</DialogTitle>
      </DialogHeader>

      <div class="space-y-4 py-1 text-sm">
        <div
          v-if="draft.pushedBy"
          class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/60 px-3 py-2"
        >
          <p class="text-xs text-muted-foreground">{{ t.pushedBy }}: <span class="font-medium text-foreground">{{ draft.pushedBy }}</span></p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            class="h-7 text-xs text-muted-foreground hover:text-foreground"
            @click="draft.pushedBy = undefined; draft.pushedAt = undefined"
          >
            {{ t.pushedByRemove }}
          </Button>
        </div>

        <div>
          <label class="block text-xs font-medium text-foreground">
            {{ t.cardTitle }} <span class="text-destructive">*</span>
          </label>
          <Input
            v-model="draft.title"
            class="mt-1"
            :class="submitted && !draft.title?.trim() ? 'border-destructive focus-visible:ring-destructive' : ''"
            placeholder="e.g. GitHub"
          />
          <p v-if="submitted && !draft.title?.trim()" class="mt-1 text-xs text-destructive">
            {{ t.titleRequired }}
          </p>
        </div>

        <div>
          <label class="block text-xs font-medium text-foreground">
            {{ t.cardUrl }}
          </label>
          <Input v-model="draft.url" class="mt-1" placeholder="https://example.com" />
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label class="block text-xs font-medium text-foreground">
              {{ t.cardType }}
            </label>
            <select
              v-model="draft.type"
              class="border-input mt-1 h-9 w-full rounded-md border bg-card px-3 py-1 text-sm text-foreground shadow-xs transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <option value="simple">{{ t.typeSimple }}</option>
              <option value="desc-clickable">{{ t.typeDesc }}</option>
              <option value="expandable">{{ t.typeExpand }}</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-medium text-foreground">
              {{ t.icon }}
            </label>
            <div class="mt-1 flex gap-1">
              <Button
                type="button"
                size="sm"
                class="h-9 flex-1 text-xs"
                :variant="iconKind === 'emoji' ? 'default' : 'outline'"
                @click="setKind('emoji')"
              >
                {{ t.iconEmoji }}
              </Button>
              <Button
                type="button"
                size="sm"
                class="h-9 flex-1 text-xs"
                :variant="iconKind === 'img' ? 'default' : 'outline'"
                @click="setKind('img')"
              >
                {{ t.iconImage }}
              </Button>
              <Button
                type="button"
                size="sm"
                class="h-9 flex-1 text-xs"
                :variant="iconKind === 'svg' ? 'default' : 'outline'"
                @click="setKind('svg')"
              >
                {{ t.iconSvg }}
              </Button>
            </div>
          </div>
        </div>

        <div>
          <Input v-if="iconKind === 'img'" v-model="draft.iconImg" :placeholder="t.iconImage" />
          <Textarea v-else-if="iconKind === 'svg'" v-model="draft.icon" class="min-h-16 font-mono text-xs" placeholder="<svg ...>" />
          <Input v-else v-model="draft.icon" :placeholder="t.iconEmoji" />
        </div>

        <div v-if="draft.type !== 'desc-clickable'">
          <label class="block text-xs font-medium text-foreground">
            {{ t.cardDesc }}
          </label>
          <Input v-model="draft.desc" class="mt-1" placeholder="คำอธิบายสั้นๆ" />
        </div>

        <!-- Expandable Subcards -->
        <div v-if="draft.type === 'expandable'" class="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
          <div class="flex items-center justify-between">
            <p class="text-xs font-medium text-foreground">{{ t.subcards }}</p>
            <Button type="button" size="sm" variant="outline" class="h-7 gap-1 text-xs" @click="addSub">
              <Plus class="size-3" />
              <span>{{ t.addSubcard }}</span>
            </Button>
          </div>
          <div
            v-for="(sub, index) in draft.subCards"
            :key="index"
            class="flex items-start gap-2 rounded-lg border border-border bg-card p-2.5 shadow-xs"
          >
            <div class="min-w-0 flex-1 space-y-1.5">
              <Input
                :model-value="sub.content ?? sub.title ?? ''"
                class="h-8 text-xs"
                :placeholder="t.cardTitle"
                @update:model-value="(value) => patchSub(index, sub.content !== undefined ? { content: String(value) } : { title: String(value) })"
              />
              <Input
                :model-value="sub.url ?? ''"
                class="h-8 text-xs"
                :placeholder="t.cardUrl"
                @update:model-value="(value) => patchSub(index, { url: String(value) })"
              />
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              class="size-8 shrink-0 text-muted-foreground hover:text-destructive"
              @click="removeSub(index)"
            >
              <Trash2 class="size-3.5" />
            </Button>
          </div>
        </div>

        <!-- Progressive Disclosure: Collapsible Advanced Settings -->
        <div class="rounded-xl border border-border overflow-hidden">
          <button
            type="button"
            class="flex w-full items-center justify-between bg-muted/40 px-3.5 py-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            @click="showAdvanced = !showAdvanced"
          >
            <span>{{ t.advancedSettings }}</span>
            <ChevronDown
              class="size-4 text-muted-foreground transition-transform duration-200"
              :class="showAdvanced ? 'rotate-180' : ''"
            />
          </button>

          <div v-if="showAdvanced" class="space-y-3.5 p-3.5">
            <div v-if="draft.type === 'desc-clickable'" class="space-y-2">
              <div>
                <label class="block text-xs font-medium text-foreground">
                  {{ t.cardDescClickable }}
                </label>
                <Input v-model="draft.descClickable" class="mt-1" />
              </div>
              <div>
                <label class="block text-xs font-medium text-foreground">
                  {{ t.cardDescUrl }}
                </label>
                <Input v-model="draft.descUrl" class="mt-1" />
              </div>
            </div>

            <label class="flex items-center gap-2 text-xs font-medium text-foreground">
              <input v-model="draft.isLocal" type="checkbox" class="size-4 rounded border-input text-primary focus:ring-ring" />
              <span>{{ t.cardLocal }}</span>
            </label>

            <div>
              <label class="block text-xs font-medium text-foreground">
                {{ t.cardComment }}
              </label>
              <Textarea v-model="draft.comment" class="mt-1 min-h-20 text-xs" placeholder="Markdown note..." />
            </div>
          </div>
        </div>
      </div>

      <DialogFooter class="gap-2 sm:gap-0">
        <Button variant="outline" @click="emit('update:open', false)">{{ t.cancel }}</Button>
        <Button :disabled="!draft.title?.trim()" @click="submit">{{ t.save }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
