import { ref } from 'vue'
import { defineStore } from 'pinia'

import {
  inboxAction,
  listInbox,
  sendInbox,
  setInboxPolicy,
  type InboxMessage,
  type InboxStatus,
} from '@/lib/api'
import type { BookmarkCard } from '@/types/bookmark'

export const useInboxStore = defineStore('inbox', () => {
  const received = ref<InboxMessage[]>([])
  const sent = ref<InboxMessage[]>([])
  const unreadCount = ref(0)
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const error = ref('')

  async function refresh(kind: 'received' | 'sent' = 'received', filter: InboxStatus | '' = '') {
    status.value = 'loading'
    error.value = ''
    try {
      const payload = await listInbox(kind, filter)
      if (kind === 'sent') sent.value = payload.messages
      else {
        received.value = payload.messages
        unreadCount.value = payload.unreadCount
      }
      status.value = 'ready'
    } catch {
      error.value = 'inbox-failed'
      status.value = 'error'
    }
  }

  async function refreshUnread() {
    try {
      const payload = await listInbox('received', 'pending')
      unreadCount.value = payload.unreadCount
    } catch {
      unreadCount.value = 0
    }
  }

  async function act(
    action: string,
    body: Record<string, unknown>,
    list: 'received' | 'sent' = 'received',
  ) {
    await inboxAction(action, body)
    await refresh(list)
    if (list === 'received') await refreshUnread()
  }

  async function send(toUsername: string, cards: BookmarkCard[], message: string, sectionKey: string) {
    const result = await sendInbox(toUsername, cards, message, sectionKey)
    await refresh('sent')
    return result
  }

  async function setPolicy(policy: 'open' | 'closed') {
    await setInboxPolicy(policy)
  }

  return {
    received,
    sent,
    unreadCount,
    status,
    error,
    refresh,
    refreshUnread,
    act,
    send,
    setPolicy,
  }
})
