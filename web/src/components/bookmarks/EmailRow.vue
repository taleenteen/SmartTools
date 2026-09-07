<script setup lang="ts">
import { computed } from 'vue'

import BookmarkIcon from '@/components/bookmarks/BookmarkIcon.vue'
import MotionPressable from '@/components/bookmarks/MotionPressable.vue'
import { openHref } from '@/lib/resolve-url'
import type { BookmarkSection } from '@/types/bookmark'

const props = defineProps<{
  email?: BookmarkSection
  contact?: BookmarkSection
}>()

const emails = computed(() => props.email?.cards ?? [])
const contacts = computed(() => props.contact?.cards ?? [])
const primary = computed(() => emails.value[0])
</script>

<template>
  <section v-if="emails.length || contacts.length" class="space-y-3">
    <h2 class="text-sm font-semibold tracking-wide text-foreground">
      {{ email?.label || contact?.label }}
    </h2>
    <div class="grid gap-2.5 sm:grid-cols-2">
      <MotionPressable
        v-if="primary"
        :href="openHref(primary.url || primary.mailto, primary.isLocal)"
        class="p-3.5"
      >
        <div class="flex items-start gap-3">
          <BookmarkIcon :icon="primary.icon" :icon-img="primary.iconImg" />
          <div class="min-w-0">
            <h3 class="text-sm font-semibold">{{ primary.title }}</h3>
            <p class="truncate text-xs text-muted-foreground">{{ primary.address || primary.desc }}</p>
          </div>
        </div>
      </MotionPressable>
      <MotionPressable
        v-for="(item, index) in contacts"
        :key="item.id || item.url || index"
        :href="openHref(item.url, item.isLocal)"
        class="p-3.5"
      >
        <div class="flex items-start gap-3">
          <BookmarkIcon :icon="item.icon" :icon-img="item.iconImg" />
          <div class="min-w-0">
            <h3 class="text-sm font-semibold">{{ item.title }}</h3>
            <p class="truncate text-xs text-muted-foreground">{{ item.desc }}</p>
          </div>
        </div>
      </MotionPressable>
    </div>
  </section>
</template>
