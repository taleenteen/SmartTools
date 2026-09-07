<script setup lang="ts">
import { RouterLink } from 'vue-router'

import ThemeSwitcher from '@/components/bookmarks/ThemeSwitcher.vue'
import { Button } from '@/components/ui/button'
import { t } from '@/i18n/th'

interface ToolLink {
  href: string
  icon: string
  title: string
  desc: string
  external?: boolean
}

const tools: ToolLink[] = [
  { href: '/tools/ydyjsq.html', icon: '🧮', title: 'Estimator', desc: 'เครื่องคิดเลขประมาณค่า' },
  { href: '/tools/9gg3.html', icon: '📜', title: 'Poetry grid', desc: 'จดจำบทกวีด้วยตารางเก้าช่อง' },
  { href: '/tools/slxzsd.html?from=toolsindex', icon: '🩺', title: 'Physiology', desc: 'จุดความรู้สรีรวิทยา' },
  { href: '/tools/math3-4.html', icon: '📚', title: 'Mental math 3–4', desc: 'แบบฝึกหัดช่วงชั้น' },
  { href: '/tools/math3.html', icon: '📚', title: 'Mental math 3', desc: 'แบบฝึกภาคเรียนล่าง' },
]

const groups: { title: string; desc: string; icon: string; items: ToolLink[] }[] = [
  {
    title: 'Personal',
    desc: 'บริการที่ใช้เอง',
    icon: '🧭',
    items: [
      { href: 'https://wn.n29.net/', icon: '🗳', title: 'AI notebook', desc: 'wn.n29.net', external: true },
      { href: 'https://vbw.n29.net/', icon: '🛡', title: 'Passwords', desc: 'vbw.n29.net', external: true },
      { href: 'https://scandex.n29.net/', icon: '📇', title: 'Scanner', desc: 'scandex.n29.net', external: true },
      { href: 'https://addr.f66.fun/', icon: '🗺️', title: 'Address', desc: 'addr.f66.fun', external: true },
    ],
  },
  {
    title: 'Video',
    desc: 'แหล่งวิดีโอ',
    icon: '🤹',
    items: [
      { href: 'https://m.f66.fun/', icon: '🌗', title: 'LunaTV', desc: 'm.f66.fun', external: true },
      { href: 'https://k.f66.fun/', icon: '🌘', title: 'KatTV', desc: 'k.f66.fun', external: true },
      { href: 'https://m2.f66.fun/', icon: '🌜️', title: 'MoonTV', desc: 'm2.f66.fun', external: true },
      { href: 'https://xy.f66.fun/', icon: '🌈', title: 'Xiaoya', desc: 'xy.f66.fun', external: true },
      { href: 'https://pso.992929.xyz/', icon: '🔍', title: 'Pan search', desc: 'ค้นหาเน็ตไดรฟ์', external: true },
    ],
  },
]

function openTool(href: string, external?: boolean) {
  if (external) window.open(href, '_blank', 'noopener,noreferrer')
  else window.location.assign(href)
}
</script>

<template>
  <main class="mx-auto flex min-h-svh w-full max-w-md flex-col px-5 pb-16 pt-14">
    <header class="mb-8 flex items-start justify-between gap-3">
      <div>
        <p class="text-sm text-muted-foreground">{{ t.appName }}</p>
        <h1 class="text-2xl font-semibold tracking-tight">{{ t.toolsTitle }}</h1>
        <p class="mt-1 text-sm text-muted-foreground">{{ t.toolsSubtitle }}</p>
      </div>
      <div class="flex items-center gap-2">
        <Button as-child size="sm" variant="outline" class="rounded-full">
          <RouterLink to="/">{{ t.toolsFav }}</RouterLink>
        </Button>
        <Button as-child size="sm" variant="outline" class="rounded-full">
          <a href="/about.html">{{ t.toolsAbout }}</a>
        </Button>
        <ThemeSwitcher />
      </div>
    </header>

    <ul class="space-y-3">
      <li v-for="tool in tools" :key="tool.href">
        <button
          type="button"
          class="flex w-full items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-card-hover focus-visible:ring-2 focus-visible:ring-ring"
          @click="openTool(tool.href)"
        >
          <span class="text-xl">{{ tool.icon }}</span>
          <span>
            <span class="block font-medium">{{ tool.title }}</span>
            <span class="text-sm text-muted-foreground">{{ tool.desc }}</span>
          </span>
        </button>
      </li>
      <li v-for="group in groups" :key="group.title" class="rounded-xl border border-border bg-card p-4">
        <p class="font-medium">{{ group.icon }} {{ group.title }}</p>
        <p class="mb-2 text-sm text-muted-foreground">{{ group.desc }}</p>
        <div class="flex flex-col gap-2">
          <button
            v-for="item in group.items"
            :key="item.href"
            type="button"
            class="rounded-lg bg-muted px-3 py-2 text-left text-sm transition-colors hover:bg-card-hover"
            @click="openTool(item.href, item.external)"
          >
            {{ item.icon }} {{ item.title }}
            <span class="ml-2 text-xs text-muted-foreground">{{ item.desc }}</span>
          </button>
        </div>
      </li>
    </ul>
  </main>
</template>
