<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

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
  ApiError,
  PUBLIC_ACCEPT_KEYS,
  inboxAction,
  type InboxMessage,
  type InboxStatus,
} from '@/lib/api'
import { isEncryptedLocked } from '@/lib/normalize-sections'
import { useEditorStore } from '@/stores/editor'
import { useEncryptStore } from '@/stores/encrypt'
import { useInboxStore } from '@/stores/inbox'
import { useSessionStore } from '@/stores/session'
import type { BookmarkCard } from '@/types/bookmark'
import PushView from '@/views/settings/PushView.vue'

const inbox = useInboxStore()
const editor = useEditorStore()
const encrypt = useEncryptStore()
const session = useSessionStore()

const kind = ref<'received' | 'sent'>('received')
const filter = ref<InboxStatus | ''>('pending')
const panel = ref<'box' | 'send' | 'push'>('box')
const toUser = ref('')
const sendMessage = ref('')
const sendSection = ref('custom_unclassified')
const selected = ref<BookmarkCard[]>([])
const sendStatus = ref('')
const sendError = ref('')

const acceptMsg = ref<InboxMessage | null>(null)
const acceptKey = ref('custom_unclassified')
const acceptError = ref('')
const acceptSaved = ref(false)
const acceptDrafts = ref<BookmarkCard[]>([])

const list = computed(() => (kind.value === 'sent' ? inbox.sent : inbox.received))

const publicTargets = computed(() =>
  editor.sections.filter((section) => PUBLIC_ACCEPT_KEYS.includes(section.key as (typeof PUBLIC_ACCEPT_KEYS)[number]) && !section.encrypted),
)

const encryptedTargets = computed(() =>
  editor.sections.filter((section) => section.encrypted && !isEncryptedLocked(section)),
)

onMounted(() => {
  void editor
    .load()
    .then(() => encrypt.bootstrap())
    .catch(() => undefined)
  void loadList()
})

async function loadList() {
  await inbox.refresh(kind.value, filter.value)
}

function toggleCard(card: BookmarkCard) {
  const id = card.id || card.title || ''
  selected.value = selected.value.some((item) => (item.id || item.title) === id)
    ? selected.value.filter((item) => (item.id || item.title) !== id)
    : [...selected.value, card]
}

const pickable = () =>
  editor.sections.filter((section) => !isEncryptedLocked(section)).flatMap((section) => section.cards)

async function send() {
  sendError.value = ''
  sendStatus.value = ''
  if (!toUser.value.trim()) {
    sendError.value = t.inboxNeedUser
    return
  }
  if (!selected.value.length) {
    sendError.value = t.inboxNeedCards
    return
  }
  try {
    await inbox.send(toUser.value.trim(), selected.value, sendMessage.value, sendSection.value)
    sendStatus.value = t.inboxSentOk
    selected.value = []
  } catch (err) {
    sendError.value = err instanceof ApiError && err.status === 429 ? t.inboxRateLimited : t.saveFailed
  }
}

async function openAccept(msg: InboxMessage) {
  acceptMsg.value = msg
  acceptError.value = ''
  acceptSaved.value = false
  acceptDrafts.value = structuredClone(msg.cards)
  acceptKey.value = msg.fromEncrypted
    ? encryptedTargets.value[0]?.key || ''
    : publicTargets.value[0]?.key || 'custom_unclassified'
  if (msg.fromEncrypted) {
    try {
      const fetched = await inboxAction('fetch-for-encrypt', { msgId: msg.msgId })
      if (Array.isArray(fetched.cards)) acceptDrafts.value = fetched.cards as BookmarkCard[]
    } catch {
      acceptError.value = t.inboxNeedUnlock
    }
  }
}

async function confirmAccept() {
  const msg = acceptMsg.value
  if (!msg) return
  acceptError.value = ''
  try {
    if (msg.fromEncrypted) {
      if (!acceptKey.value || !encrypt.hasPassword) {
        acceptError.value = t.inboxNeedUnlock
        encrypt.openDialog()
        return
      }
      if (!acceptSaved.value) {
        editor.appendCards(acceptKey.value, acceptDrafts.value)
        await editor.save()
        acceptSaved.value = true
      }
      try {
        await inboxAction('mark-encrypted-done', { msgId: msg.msgId, target_section_key: acceptKey.value })
      } catch {
        acceptError.value = t.inboxMarkFailed
        return
      }
    } else {
      await inbox.act('accept-public', {
        msgId: msg.msgId,
        target_section_key: acceptKey.value,
        edited_cards: acceptDrafts.value,
      })
      await editor.load()
    }
    acceptMsg.value = null
    await loadList()
  } catch {
    acceptError.value = t.saveFailed
  }
}

async function reject(msg: InboxMessage) {
  await inbox.act('reject', { msgId: msg.msgId }, 'received')
}

async function remove(msg: InboxMessage) {
  if (kind.value === 'sent') await inbox.act('delete-sent', { msgId: msg.msgId }, 'sent')
  else if (msg.status === 'rejected') await inbox.act('delete-rejected', { msgId: msg.msgId }, 'received')
  else if (msg.status === 'accepted') await inbox.act('delete-accepted', { msgId: msg.msgId }, 'received')
}
</script>

<template>
  <div>
    <div class="mb-4 flex flex-wrap gap-2">
      <Button size="sm" class="rounded-full" :variant="panel === 'box' ? 'default' : 'outline'" @click="panel = 'box'">
        {{ t.navInbox }}
      </Button>
      <Button size="sm" class="rounded-full" :variant="panel === 'send' ? 'default' : 'outline'" @click="panel = 'send'">
        {{ t.inboxSend }}
      </Button>
      <Button
        v-if="session.role === 'admin'"
        size="sm"
        class="rounded-full"
        :variant="panel === 'push' ? 'default' : 'outline'"
        @click="panel = 'push'"
      >
        {{ t.inboxPush }}
      </Button>
    </div>

    <PushView v-if="panel === 'push'" />

    <div v-else-if="panel === 'send'" class="space-y-3">
      <label class="block text-sm">
        {{ t.inboxTo }}
        <Input v-model="toUser" class="mt-1" autocomplete="off" />
      </label>
      <label class="block text-sm">
        {{ t.inboxTargetSection }}
        <select v-model="sendSection" class="border-input mt-1 h-8 w-full rounded-lg border bg-transparent px-2">
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
      <Textarea v-model="sendMessage" :placeholder="t.inboxMessage" class="min-h-20" />
      <p v-if="sendError" class="text-sm text-destructive">{{ sendError }}</p>
      <p v-else-if="sendStatus" class="text-sm text-primary">{{ sendStatus }}</p>
      <Button size="sm" @click="send">{{ t.inboxSend }}</Button>
    </div>

    <div v-else>
      <div class="mb-3 flex flex-wrap gap-2">
        <Button size="sm" :variant="kind === 'received' ? 'default' : 'outline'" @click="kind = 'received'; loadList()">
          {{ t.inboxReceived }}
        </Button>
        <Button size="sm" :variant="kind === 'sent' ? 'default' : 'outline'" @click="kind = 'sent'; loadList()">
          {{ t.inboxSent }}
        </Button>
        <Button
          v-for="item in (['pending', 'accepted', 'rejected', ''] as const)"
          :key="item || 'all'"
          size="sm"
          variant="ghost"
          @click="filter = item; loadList()"
        >
          {{ item === 'pending' ? t.inboxPending : item === 'accepted' ? t.inboxAccepted : item === 'rejected' ? t.inboxRejected : t.inboxAll }}
        </Button>
      </div>
      <p v-if="inbox.status === 'loading'" class="text-sm text-muted-foreground">{{ t.checkingSession }}</p>
      <p v-else-if="!list.length" class="text-sm text-muted-foreground">{{ t.inboxEmpty }}</p>
      <ul v-else class="space-y-2">
        <li
          v-for="msg in list"
          :key="msg.msgId"
          class="rounded-xl border border-border bg-card p-3 text-sm"
        >
          <p class="font-medium">
            {{ kind === 'sent' ? msg.toUsername : msg.fromUsername }}
            <span class="ml-2 text-xs text-muted-foreground">{{ msg.status }}</span>
          </p>
          <p class="mt-1 text-xs text-muted-foreground">{{ msg.sentAt }} · {{ msg.cards.length }} cards</p>
          <p v-if="msg.message" class="mt-1 text-muted-foreground">{{ msg.message }}</p>
          <div v-if="kind === 'received'" class="mt-2 flex flex-wrap gap-2">
            <Button v-if="msg.status === 'pending' || msg.status === 'rejected'" size="sm" @click="openAccept(msg)">
              {{ t.inboxAccept }}
            </Button>
            <Button v-if="msg.status === 'pending'" size="sm" variant="outline" @click="reject(msg)">
              {{ t.inboxReject }}
            </Button>
            <Button v-if="msg.status === 'rejected' || msg.status === 'accepted'" size="sm" variant="ghost" @click="remove(msg)">
              {{ t.delete }}
            </Button>
          </div>
          <Button v-else size="sm" variant="ghost" class="mt-2" @click="remove(msg)">{{ t.delete }}</Button>
        </li>
      </ul>
    </div>

    <Dialog :open="!!acceptMsg" @update:open="(open: boolean) => !open && (acceptMsg = null)">
      <DialogContent class="max-w-lg">
        <DialogHeader>
          <DialogTitle>{{ t.inboxAccept }}</DialogTitle>
        </DialogHeader>
        <p class="text-sm text-muted-foreground">{{ t.inboxEditHint }}</p>
        <p v-if="acceptMsg?.fromEncrypted" class="text-sm text-muted-foreground">{{ t.inboxEncryptedOnly }}</p>
        <label class="block text-sm">
          {{ t.inboxTargetSection }}
          <select v-model="acceptKey" class="border-input mt-1 h-8 w-full rounded-lg border bg-transparent px-2">
            <option
              v-for="section in acceptMsg?.fromEncrypted ? encryptedTargets : publicTargets"
              :key="section.key"
              :value="section.key"
            >
              {{ section.label }}
            </option>
          </select>
        </label>
        <div
          v-for="(card, index) in acceptDrafts"
          :key="card.id || index"
          class="space-y-2 rounded-lg border border-border p-3"
        >
          <label class="block text-sm">
            {{ t.inboxCardTitle }}
            <Input v-model="card.title" class="mt-1" />
          </label>
          <label class="block text-sm">
            {{ t.inboxCardUrl }}
            <Input v-model="card.url" class="mt-1" />
          </label>
          <label class="block text-sm">
            {{ t.inboxCardDesc }}
            <Input v-model="card.desc" class="mt-1" />
          </label>
        </div>
        <p v-if="acceptError" class="text-sm text-destructive">{{ acceptError }}</p>
        <DialogFooter>
          <Button variant="outline" @click="acceptMsg = null">{{ t.cancel }}</Button>
          <Button @click="confirmAccept">{{ t.confirm }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
