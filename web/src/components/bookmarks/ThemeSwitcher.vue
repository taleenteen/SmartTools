<script setup lang="ts">
import { Check } from '@lucide/vue'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useThemeStore } from '@/stores/theme'
import type { ThemeId } from '@/types/theme'

const theme = useThemeStore()

function select(id: ThemeId) {
  theme.setTheme(id)
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        variant="outline"
        size="sm"
        class="gap-2 rounded-full border-border bg-card/90 text-foreground shadow-sm backdrop-blur-sm"
      >
        <span aria-hidden="true">{{ theme.current.emoji }}</span>
        <span>{{ theme.current.label }}</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="min-w-44">
      <DropdownMenuItem
        v-for="item in theme.list"
        :key="item.id"
        class="gap-2"
        @click="select(item.id)"
      >
        <span class="w-5" aria-hidden="true">{{ item.emoji }}</span>
        <span class="flex-1">{{ item.label }}</span>
        <Check v-if="item.id === theme.id" class="size-4 text-primary" />
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
