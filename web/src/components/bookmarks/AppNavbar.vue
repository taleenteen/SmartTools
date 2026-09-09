<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { Bookmark, Film, FileText, Settings, Sparkles } from 'lucide-vue-next'
import ThemeSwitcher from '@/components/bookmarks/ThemeSwitcher.vue'
import { t } from '@/i18n/th'
import { useInboxStore } from '@/stores/inbox'
import { useSessionStore } from '@/stores/session'

const route = useRoute()
const session = useSessionStore()
const inbox = useInboxStore()

onMounted(async () => {
  await session.check()
  if (session.loggedIn) void inbox.refreshUnread()
})

// Determine active section based on current route
const currentSection = computed<'bookmarks' | 'manga' | 'notes' | 'settings'>(() => {
  const p = route.path
  if (p === '/' || p === '/l') return 'bookmarks'
  if (p.startsWith('/manga')) return 'manga'
  if (p.startsWith('/notes')) return 'notes'
  if (p.startsWith('/settings') || p.startsWith('/c')) return 'settings'
  return 'bookmarks'
})

const navItems = computed(() => [
  { id: 'bookmarks', path: '/', label: t.bookmarks, icon: Bookmark },
  { id: 'manga', path: '/manga', label: t.manga, icon: Film },
  { id: 'notes', path: '/notes', label: t.notes, icon: FileText },
  {
    id: 'settings',
    path: '/settings',
    label: t.settings,
    icon: Settings,
    badge: inbox.unreadCount > 0 ? inbox.unreadCount : null,
  },
])
</script>

<template>
  <header class="sticky top-3 z-40 w-full max-w-md sm:max-w-3xl lg:max-w-6xl mx-auto px-4 mb-6 transition-all duration-200">
    <nav class="flex items-center justify-between gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-2xl bg-card/85 backdrop-blur-md border border-border/70 shadow-xs">
      <!-- 1. Logo & Brand -->
      <RouterLink
        to="/"
        class="flex items-center gap-2 font-bold tracking-tight text-foreground hover:opacity-90 transition-opacity shrink-0"
      >
        <div class="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <Sparkles class="size-4" />
        </div>
        <span class="text-base sm:text-lg font-bold hidden sm:inline-block tracking-tight">
          {{ t.appName }}
        </span>
      </RouterLink>

      <!-- 2. Nav Tabs with Persistent Active Pill -->
      <div class="flex items-center gap-1 sm:gap-1.5 p-1 rounded-xl bg-muted/40 border border-border/40 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <RouterLink
          v-for="item in navItems"
          :key="item.id"
          :to="item.path"
          :class="[
            'flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 shrink-0 select-none',
            currentSection === item.id
              ? 'bg-primary text-primary-foreground shadow-xs font-semibold scale-[1.02]'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
          ]"
        >
          <component :is="item.icon" class="size-3.5 sm:size-4 shrink-0" />
          <span>{{ item.label }}</span>
          <span
            v-if="item.badge"
            :class="[
              'ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-bold',
              currentSection === item.id
                ? 'bg-primary-foreground text-primary'
                : 'bg-primary text-primary-foreground'
            ]"
          >
            {{ item.badge }}
          </span>
        </RouterLink>
      </div>

      <!-- 3. Utilities (Theme Switcher & Quick Actions) -->
      <div class="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <ThemeSwitcher />
      </div>
    </nav>
  </header>
</template>
