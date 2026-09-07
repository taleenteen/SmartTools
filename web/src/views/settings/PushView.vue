<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { t } from '@/i18n/th'
import { ApiError, PUBLIC_ACCEPT_KEYS, pushCards } from '@/lib/api'
import { isEncryptedLocked } from '@/lib/normalize-sections'
import { useEditorStore } from '@/stores/editor'
import { useUsersStore } from '@/stores/users'
import type { BookmarkCard } from '@/types/bookmark'

const editor = useEditorStore()
const users = useUsersStore()
const targets = ref<string[]>([])
const sectionKey = ref('custom_unclassified')
const message = ref('')
const mode = ref<'append' | 'force'>('append')
const selected = ref<BookmarkCard[]>([])
const status = ref('')
const error = ref('')

onMounted(() => {
  if (!users.items.length) void users.refresh()
  if (editor.status !== 'ready') void editor.load()
})

function toggleUser(name: string) {
  targets.value = targets.value.includes(name) ? targets.value.filter((item) => item !== name) : [...targets.value, name]
}

function toggleCard(card: BookmarkCard) {
  const id = card.id || card.title || ''
  selected.value = selected.value.some((item) => (item.id || item.title) === id)
    ? selected.value.filter((item) => (item.id || item.title) !== id)
    : [...selected.value, card]
}

const pickable = () =>
  editor.sections.filter((section) => !isEncryptedLocked(section)).flatMap((section) => section.cards)

async function submit() {
  error.value = ''
  status.value = ''
  if (!targets.value.length) {
    error.value = t.inboxNeedUser
    return
  }
  if (!selected.value.length) {
    error.value = t.inboxNeedCards
    return
  }
  if (mode.value === 'force' && selected.value.length !== 1) {
    error.value = t.inboxNeedCards
    return
  }
  try {
    await pushCards({
      target_users: targets.value,
      section_key: sectionKey.value,
      cards: selected.value,
      message: message.value,
      mode: mode.value,
    })
    status.value = t.inboxSentOk
  } catch (err) {
    error.value = err instanceof ApiError && err.status === 429 ? t.inboxRateLimited : t.saveFailed
  }
}
</script>

<template>
  <div class="space-y-3">
    <p class="text-sm font-medium">{{ t.inboxPush }}</p>
    <div class="flex flex-wrap gap-2">
      <label class="flex items-center gap-1 text-sm">
        <input v-model="mode" type="radio" value="append" />
        {{ t.inboxAppend }}
      </label>
      <label class="flex items-center gap-1 text-sm">
        <input v-model="mode" type="radio" value="force" />
        {{ t.inboxForce }}
      </label>
    </div>
    <p class="text-sm">{{ t.pushTargets }}</p>
    <label v-for="row in users.items" :key="row.username" class="flex items-center gap-2 text-sm">
      <input :checked="targets.includes(row.username)" type="checkbox" @change="toggleUser(row.username)" />
      {{ row.username }}
    </label>
    <label class="block text-sm">
      {{ t.inboxTargetSection }}
      <select v-model="sectionKey" class="border-input mt-1 h-8 w-full rounded-lg border bg-transparent px-2">
        <option v-for="key in PUBLIC_ACCEPT_KEYS" :key="key" :value="key">{{ key }}</option>
      </select>
    </label>
    <p class="text-sm">{{ t.inboxPickCards }}</p>
    <label v-for="card in pickable()" :key="card.id || card.title" class="flex items-center gap-2 text-sm">
      <input
        :checked="selected.some((item) => (item.id || item.title) === (card.id || card.title))"
        type="checkbox"
        @change="toggleCard(card)"
      />
      {{ card.title || card.id }}
    </label>
    <Textarea v-model="message" :placeholder="t.inboxMessage" class="min-h-20" />
    <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
    <p v-else-if="status" class="text-sm text-primary">{{ status }}</p>
    <Button size="sm" @click="submit">{{ t.inboxPush }}</Button>
  </div>
</template>
