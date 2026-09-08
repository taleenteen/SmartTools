<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'

import { Button } from '@/components/ui/button'
import ThemeSwitcher from '@/components/bookmarks/ThemeSwitcher.vue'
import { t } from '@/i18n/th'
import { useInboxStore } from '@/stores/inbox'
import { useModeStore } from '@/stores/mode'
import { useSessionStore } from '@/stores/session'
import { useViewerStore } from '@/stores/viewer'

const viewer = useViewerStore()
const session = useSessionStore()
const inbox = useInboxStore()
const mode = useModeStore()

onMounted(async () => {
  await session.check()
  if (session.loggedIn && mode.kind === 'online') void inbox.refreshUnread()
})
</script>

<template>
  <header class="mb-8 flex items-start justify-between gap-3">
    <div>
      <p class="text-sm text-muted-foreground">{{ t.appName }}</p>
      <h1 class="text-2xl font-semibold tracking-tight text-foreground">{{ t.bookmarks }}</h1>
      <p v-if="viewer.slug || viewer.username" class="mt-1 text-xs text-muted-foreground">
        {{ viewer.slug || viewer.username }}
      </p>
    </div>
    <div class="flex items-center gap-2">
      <Button as-child size="sm" variant="outline" class="rounded-full">
        <RouterLink to="/manga" :title="t.mangaSubtitle">{{ t.manga }}</RouterLink>
      </Button>
      <Button as-child size="sm" variant="outline" class="rounded-full">
        <RouterLink to="/t" :title="t.toolsHint">{{ t.tools }}</RouterLink>
      </Button>
      <Button v-if="viewer.isAdminView || session.loggedIn" as-child size="sm" class="rounded-full">
        <RouterLink to="/settings" :title="t.settingsHint">
          {{ t.settings }}
          <span
            v-if="inbox.unreadCount"
            class="ml-1 rounded-full bg-primary-foreground px-1.5 text-[10px] text-primary"
          >
            {{ inbox.unreadCount }}
          </span>
        </RouterLink>
      </Button>
      <ThemeSwitcher />
    </div>
  </header>
</template>
