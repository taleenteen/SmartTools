<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { Button } from '@/components/ui/button'
import ThemeSwitcher from '@/components/bookmarks/ThemeSwitcher.vue'
import { t } from '@/i18n/th'
import { useSessionStore } from '@/stores/session'
import UnlockDialog from '@/components/bookmarks/UnlockDialog.vue'
import LoginView from '@/views/settings/LoginView.vue'
import CardsView from '@/views/settings/CardsView.vue'
import BackupView from '@/views/settings/BackupView.vue'
import SourceView from '@/views/settings/SourceView.vue'
import ImportExportView from '@/views/settings/ImportExportView.vue'
import AccountView from '@/views/settings/AccountView.vue'
import UsersView from '@/views/settings/UsersView.vue'
import InboxView from '@/views/settings/InboxView.vue'
import { useInboxStore } from '@/stores/inbox'
import { useModeStore } from '@/stores/mode'
import { useEditorStore } from '@/stores/editor'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const inbox = useInboxStore()
const mode = useModeStore()
const editor = useEditorStore()

type TabKey = 'cards' | 'backup' | 'source' | 'io' | 'account' | 'users' | 'inbox'
const validTabs: TabKey[] = ['cards', 'backup', 'source', 'io', 'account', 'users', 'inbox']

const tab = computed<TabKey>({
  get() {
    const queryTab = route.query.tab as string
    if (validTabs.includes(queryTab as TabKey)) {
      return queryTab as TabKey
    }
    return 'cards'
  },
  set(newTab) {
    void router.replace({
      query: {
        ...route.query,
        tab: newTab,
      },
    })
  },
})

const navItems = computed(() => {
  const local = mode.kind === 'local'
  const items: { id: TabKey; label: string }[] = [
    { id: 'cards', label: t.navCards },
    { id: 'backup', label: t.navBackup },
  ]
  if (!local) {
    items.push({ id: 'source', label: t.navSource })
    items.push({ id: 'io', label: t.navImport })
    items.push({ id: 'account', label: t.navAccount })
    items.push({ id: 'inbox', label: t.navInbox })
    if (session.role === 'admin') items.push({ id: 'users', label: t.navUsers })
  } else {
    items.push({ id: 'io', label: t.navImport })
    items.push({ id: 'account', label: t.navAccount })
  }
  return items
})

onMounted(async () => {
  await session.check()
  if (session.loggedIn && mode.kind === 'online') void inbox.refreshUnread()
  if (session.loggedIn && mode.kind === 'local') {
    await mode.restoreFolder()
    if (mode.folderReady) void editor.load()
  }
})

async function connectLocal() {
  const ok = await mode.connectFolder()
  if (ok) await editor.load()
}
</script>

<template>
  <main class="relative mx-auto flex min-h-svh w-full max-w-md flex-col px-4 pb-16 pt-10 sm:max-w-3xl sm:px-6 lg:max-w-6xl lg:px-8">
    <header class="mb-8 flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="text-sm text-muted-foreground">{{ t.appName }}</p>
        <h1 class="text-2xl font-semibold tracking-tight">{{ t.settings }}</h1>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <Button as-child size="sm" variant="outline" class="rounded-full">
          <RouterLink to="/">{{ t.backBookmarks }}</RouterLink>
        </Button>
        <Button
          v-if="session.loggedIn"
          size="sm"
          variant="secondary"
          class="rounded-full"
          @click="session.logout()"
        >
          {{ t.logout }}
        </Button>
        <Button
          v-if="session.loggedIn && mode.kind === 'local'"
          size="sm"
          variant="outline"
          class="rounded-full"
          @click="connectLocal()"
        >
          {{ t.connectFolder }}
        </Button>
        <ThemeSwitcher />
      </div>
    </header>

    <p v-if="session.status === 'checking' || session.status === 'idle'" class="text-sm text-muted-foreground">
      {{ t.checkingSession }}
    </p>
    <LoginView v-else-if="!session.loggedIn" />
    <div v-else>
      <nav class="mb-6 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap">
        <Button
          v-for="item in navItems"
          :key="item.id"
          size="sm"
          class="shrink-0 rounded-full"
          :variant="tab === item.id ? 'default' : 'outline'"
          @click="tab = item.id"
        >
          {{ item.label }}
          <span
            v-if="item.id === 'inbox' && inbox.unreadCount"
            class="ml-1 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground"
          >
            {{ inbox.unreadCount }}
          </span>
        </Button>
      </nav>
      <CardsView v-if="tab === 'cards'" />
      <BackupView v-else-if="tab === 'backup'" />
      <SourceView v-else-if="tab === 'source'" />
      <ImportExportView v-else-if="tab === 'io'" />
      <AccountView v-else-if="tab === 'account'" />
      <InboxView v-else-if="tab === 'inbox'" />
      <UsersView v-else-if="tab === 'users'" />
    </div>
    <UnlockDialog />
  </main>
</template>
