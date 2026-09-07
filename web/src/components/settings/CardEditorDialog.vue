<script setup lang="ts">
import { computed, reactive, watch } from 'vue'

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
      <div class="space-y-3 text-sm">
        <div
          v-if="draft.pushedBy"
          class="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2"
        >
          <p class="text-sm">{{ t.pushedBy }}: {{ draft.pushedBy }}</p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            @click="draft.pushedBy = undefined; draft.pushedAt = undefined"
          >
            {{ t.pushedByRemove }}
          </Button>
        </div>
        <label class="block">
          {{ t.cardTitle }}
          <Input v-model="draft.title" class="mt-1" />
        </label>
        <label class="block">
          {{ t.cardType }}
          <select
            v-model="draft.type"
            class="border-input mt-1 h-8 w-full rounded-lg border bg-transparent px-2.5"
          >
            <option value="simple">{{ t.typeSimple }}</option>
            <option value="desc-clickable">{{ t.typeDesc }}</option>
            <option value="expandable">{{ t.typeExpand }}</option>
          </select>
        </label>
        <div>
          <p class="mb-1">{{ t.icon }}</p>
          <div class="mb-2 flex gap-2">
            <Button type="button" size="sm" variant="outline" @click="setKind('emoji')">{{ t.iconEmoji }}</Button>
            <Button type="button" size="sm" variant="outline" @click="setKind('img')">{{ t.iconImage }}</Button>
            <Button type="button" size="sm" variant="outline" @click="setKind('svg')">{{ t.iconSvg }}</Button>
          </div>
          <Input v-if="iconKind === 'img'" v-model="draft.iconImg" :placeholder="t.iconImage" />
          <Textarea v-else-if="iconKind === 'svg'" v-model="draft.icon" class="min-h-20 font-mono text-xs" />
          <Input v-else v-model="draft.icon" :placeholder="t.iconEmoji" />
        </div>
        <label class="block">
          {{ t.cardUrl }}
          <Input v-model="draft.url" class="mt-1" />
        </label>
        <label v-if="draft.type === 'desc-clickable'" class="block">
          {{ t.cardDescClickable }}
          <Input v-model="draft.descClickable" class="mt-1" />
        </label>
        <label v-if="draft.type === 'desc-clickable'" class="block">
          {{ t.cardDescUrl }}
          <Input v-model="draft.descUrl" class="mt-1" />
        </label>
        <label v-else class="block">
          {{ t.cardDesc }}
          <Input v-model="draft.desc" class="mt-1" />
        </label>
        <label class="flex items-center gap-2">
          <input v-model="draft.isLocal" type="checkbox" />
          {{ t.cardLocal }}
        </label>
        <label class="block">
          {{ t.cardComment }}
          <Textarea v-model="draft.comment" class="mt-1 min-h-24" />
        </label>
        <div v-if="draft.type === 'expandable'" class="space-y-2">
          <div class="flex items-center justify-between">
            <p>{{ t.subcards }}</p>
            <Button type="button" size="sm" variant="outline" @click="addSub">{{ t.addSubcard }}</Button>
          </div>
          <div
            v-for="(sub, index) in draft.subCards"
            :key="index"
            class="rounded-lg border border-border p-2"
          >
            <Input
              :model-value="sub.content ?? sub.title ?? ''"
              class="mb-2"
              :placeholder="t.cardTitle"
              @update:model-value="(value) => patchSub(index, sub.content !== undefined ? { content: String(value) } : { title: String(value) })"
            />
            <Input
              :model-value="sub.url ?? ''"
              :placeholder="t.cardUrl"
              @update:model-value="(value) => patchSub(index, { url: String(value) })"
            />
            <Button type="button" size="sm" variant="ghost" class="mt-1" @click="removeSub(index)">
              {{ t.delete }}
            </Button>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)">{{ t.cancel }}</Button>
        <Button :disabled="!draft.title" @click="submit">{{ t.save }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
