<script setup lang="ts">
import { computed } from 'vue'
import { Folder, MoreVertical, Edit2, Trash2, BookOpen } from 'lucide-vue-next'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { t } from '@/i18n/th'
import type { NoteProject, NoteFolderViewStyle } from '@/types/note'

const props = defineProps<{
  project: NoteProject
  noteCount: number
  folderStyle?: NoteFolderViewStyle
}>()

const emit = defineEmits<{
  (e: 'open', project: NoteProject): void
  (e: 'edit', project: NoteProject): void
  (e: 'delete', project: NoteProject): void
}>()

const colorBg = computed(() => {
  switch (props.project.color) {
    case 'indigo': return 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20'
    case 'violet': return 'bg-purple-500/10 text-purple-500 border-purple-500/20'
    case 'emerald': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
    case 'amber': return 'bg-amber-500/10 text-amber-500 border-amber-500/20'
    case 'rose': return 'bg-rose-500/10 text-rose-500 border-rose-500/20'
    default: return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
  }
})

const isMinimal = computed(() => props.folderStyle === 'minimal' && !props.project.coverUrl)
</script>

<template>
  <!-- 1. Minimal Folder Style (Title + Icon only) -->
  <Card
    v-if="isMinimal"
    class="group relative flex items-center justify-between p-4 rounded-2xl border border-border/70 hover:border-primary/50 hover:shadow-md transition-all duration-200 cursor-pointer bg-card/80 backdrop-blur-xs"
    @click="emit('open', project)"
  >
    <div class="flex items-center gap-3.5 min-w-0 pr-2">
      <div :class="['size-11 rounded-xl flex items-center justify-center shrink-0 border transition-transform group-hover:scale-105', colorBg]">
        <Folder class="size-6 fill-current opacity-80" />
      </div>
      <div class="min-w-0">
        <h3 class="font-bold text-base text-foreground truncate group-hover:text-primary transition-colors">
          {{ project.title }}
        </h3>
        <p class="text-xs text-muted-foreground flex items-center gap-2">
          <span>{{ noteCount }} {{ t.notes }}</span>
          <span v-if="project.description" class="truncate">• {{ project.description }}</span>
        </p>
      </div>
    </div>

    <div class="flex items-center gap-1 shrink-0" @click.stop>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="icon" class="size-8 rounded-full text-muted-foreground hover:text-foreground">
            <MoreVertical class="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-36 rounded-xl shadow-lg">
          <DropdownMenuItem class="cursor-pointer gap-2" @click="emit('edit', project)">
            <Edit2 class="size-4" />
            <span>{{ t.edit }}</span>
          </DropdownMenuItem>
          <DropdownMenuItem class="cursor-pointer gap-2 text-destructive focus:text-destructive" @click="emit('delete', project)">
            <Trash2 class="size-4" />
            <span>{{ t.delete }}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </Card>

  <!-- 2. Visual Card Style (With optional cover poster or header) -->
  <Card
    v-else
    class="group relative flex flex-col rounded-2xl overflow-hidden border border-border/70 hover:border-primary/50 hover:shadow-lg transition-all duration-300 cursor-pointer bg-card"
    @click="emit('open', project)"
  >
    <!-- Cover Image Banner or Color Header -->
    <div class="relative w-full h-36 bg-muted/40 overflow-hidden shrink-0">
      <img
        v-if="project.coverUrl"
        :src="project.coverUrl"
        class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        alt="Project Cover"
      />
      <div v-else :class="['w-full h-full flex items-center justify-center border-b', colorBg]">
        <Folder class="size-16 fill-current opacity-30 group-hover:scale-110 transition-transform duration-300" />
      </div>

      <!-- Folder tag badge -->
      <div class="absolute top-3 left-3 bg-background/85 backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-semibold shadow-xs flex items-center gap-1.5 border border-border/50 text-foreground">
        <Folder class="size-3.5 text-primary fill-primary/30" />
        <span>{{ t.notesProject }}</span>
      </div>

      <!-- Action dropdown -->
      <div class="absolute top-2.5 right-2.5" @click.stop>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="secondary" size="icon" class="size-8 rounded-full shadow-xs bg-background/80 backdrop-blur-md hover:bg-background">
              <MoreVertical class="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-36 rounded-xl shadow-lg">
            <DropdownMenuItem class="cursor-pointer gap-2" @click="emit('edit', project)">
              <Edit2 class="size-4" />
              <span>{{ t.edit }}</span>
            </DropdownMenuItem>
            <DropdownMenuItem class="cursor-pointer gap-2 text-destructive focus:text-destructive" @click="emit('delete', project)">
              <Trash2 class="size-4" />
              <span>{{ t.delete }}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>

    <!-- Body -->
    <div class="p-4 sm:p-5 flex flex-col flex-1 justify-between gap-3">
      <div>
        <h3 class="font-bold text-base sm:text-lg text-foreground group-hover:text-primary transition-colors line-clamp-1">
          {{ project.title }}
        </h3>
        <p v-if="project.description" class="text-xs sm:text-sm text-muted-foreground line-clamp-2 mt-1">
          {{ project.description }}
        </p>
      </div>

      <div class="pt-2 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
        <span class="flex items-center gap-1.5 font-medium">
          <BookOpen class="size-3.5 text-primary" />
          <span>{{ noteCount }} {{ t.notes }}</span>
        </span>
        <Button variant="ghost" size="sm" class="h-8 px-3 rounded-lg text-xs font-medium group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
          <span>เปิดโฟลเดอร์</span>
        </Button>
      </div>
    </div>
  </Card>
</template>
