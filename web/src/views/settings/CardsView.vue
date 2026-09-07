<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import BookmarkIcon from '@/components/bookmarks/BookmarkIcon.vue'
import CardEditorDialog from '@/components/settings/CardEditorDialog.vue'
import DirtyBanner from '@/components/settings/DirtyBanner.vue'
import SectionManagerDialog from '@/components/settings/SectionManagerDialog.vue'
import SectionTabs from '@/components/settings/SectionTabs.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { t } from '@/i18n/th'
import { isEncryptedLocked } from '@/lib/normalize-sections'
import { useEditorStore } from '@/stores/editor'
import { useEncryptStore } from '@/stores/encrypt'
import type { BookmarkCard } from '@/types/bookmark'

const editor = useEditorStore()
const encrypt = useEncryptStore()
const editorOpen = ref(false)
const sectionOpen = ref(false)
const editingIndex = ref<number | null>(null)
const editingCard = ref<BookmarkCard | null>(null)
const moveIndex = ref<number | null>(null)
const moveCopy = ref(false)
const moveTarget = ref('')

const locked = computed(() => {
  const section = editor.activeSection
  return section ? isEncryptedLocked(section) : false
})

onMounted(() => {
  void editor
    .load()
    .then(() => encrypt.bootstrap())
    .catch(() => undefined)
})

function openAdd() {
  editingIndex.value = null
  editingCard.value = null
  editorOpen.value = true
}

function openEdit(index: number) {
  const section = editor.activeSection
  if (!section) return
  editingIndex.value = index
  editingCard.value = { ...section.cards[index] }
  editorOpen.value = true
}

function onSaveCard(card: BookmarkCard) {
  if (editingIndex.value === null) editor.addCard(card)
  else editor.updateCard(editingIndex.value, card)
}

function patchSectionLabel(value: string | number) {
  editor.patchActive({ label: String(value) })
}

function reload() {
  if (editor.dirty && !window.confirm(t.reloadConfirm)) return
  void editor.load()
}

const moveTargets = computed(() =>
  editor.sections.filter((section) => section.key !== editor.activeKey && !isEncryptedLocked(section)),
)

function openMove(index: number, copy: boolean) {
  moveIndex.value = index
  moveCopy.value = copy
  moveTarget.value = moveTargets.value[0]?.key || ''
}

function confirmMove() {
  if (moveIndex.value == null || !moveTarget.value) return
  editor.moveCardToSection(moveIndex.value, moveTarget.value, moveCopy.value)
  moveIndex.value = null
}
</script>

<template>
  <div>
    <DirtyBanner />
    <div class="mb-3">
      <Button size="sm" variant="outline" class="rounded-full" @click="reload">{{ t.reload }}</Button>
    </div>
    <SectionTabs @manage="sectionOpen = true" />

    <div v-if="editor.activeSection" class="mb-4 flex flex-wrap items-center gap-2">
      <Input
        class="max-w-xs"
        :model-value="editor.activeSection.label"
        :disabled="locked"
        @update:model-value="patchSectionLabel"
      />
      <label v-if="!editor.activeSection.builtin" class="flex items-center gap-2 text-sm">
        <input
          :checked="editor.activeSection.dynamic"
          type="checkbox"
          @change="editor.patchActive({ dynamic: ($event.target as HTMLInputElement).checked })"
        />
        {{ t.sectionDynamic }}
      </label>
      <Button size="sm" class="rounded-full" :disabled="locked" @click="openAdd">{{ t.addCard }}</Button>
      <Button
        v-if="!editor.activeSection.builtin"
        size="sm"
        variant="ghost"
        class="rounded-full"
        @click="editor.deleteActiveSection()"
      >
        {{ t.sectionDelete }}
      </Button>
    </div>

    <p v-if="locked" class="text-sm text-muted-foreground">
      {{ t.lockedPill }}
      <Button size="sm" variant="outline" class="ml-2 rounded-full" @click="encrypt.openDialog()">
        {{ t.unlock }}
      </Button>
    </p>

    <p v-else-if="!editor.activeSection?.cards.length" class="text-sm text-muted-foreground">
      {{ t.emptySection }}
    </p>

    <ul v-else class="space-y-2">
      <li
        v-for="(card, index) in editor.activeSection?.cards"
        :key="card.id || index"
        class="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
      >
        <BookmarkIcon :icon="card.icon" :icon-img="card.iconImg" size="sm" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium">{{ card.title }}</p>
          <p class="truncate text-xs text-muted-foreground">{{ card.type }} · {{ card.url }}</p>
        </div>
        <Button size="sm" variant="ghost" @click="editor.moveCard(index, -1)">{{ t.moveUp }}</Button>
        <Button size="sm" variant="ghost" @click="editor.moveCard(index, 1)">{{ t.moveDown }}</Button>
        <Button size="sm" variant="ghost" @click="openMove(index, false)">{{ t.moveTo }}</Button>
        <Button size="sm" variant="ghost" @click="openMove(index, true)">{{ t.copyTo }}</Button>
        <Button size="sm" variant="outline" @click="openEdit(index)">{{ t.edit }}</Button>
        <Button size="sm" variant="ghost" @click="editor.removeCard(index)">{{ t.delete }}</Button>
      </li>
    </ul>

    <CardEditorDialog v-model:open="editorOpen" :card="editingCard" @save="onSaveCard" />
    <SectionManagerDialog v-model:open="sectionOpen" />

    <div
      v-if="moveIndex != null"
      class="fixed inset-0 z-40 flex items-center justify-center bg-overlay"
      @click.self="moveIndex = null"
    >
      <div class="w-full max-w-sm rounded-xl border border-border bg-card p-4 shadow-lg">
        <p class="mb-2 text-sm font-medium">{{ moveCopy ? t.copyTo : t.moveTo }}</p>
        <select v-model="moveTarget" class="border-input mb-3 h-8 w-full rounded-lg border bg-transparent px-2">
          <option v-for="section in moveTargets" :key="section.key" :value="section.key">{{ section.label }}</option>
        </select>
        <div class="flex justify-end gap-2">
          <Button size="sm" variant="outline" @click="moveIndex = null">{{ t.cancel }}</Button>
          <Button size="sm" @click="confirmMove">{{ t.confirm }}</Button>
        </div>
      </div>
    </div>
  </div>
</template>
