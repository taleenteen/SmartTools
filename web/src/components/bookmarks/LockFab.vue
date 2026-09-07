<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { t } from '@/i18n/th'
import { useEncryptStore } from '@/stores/encrypt'

const encrypt = useEncryptStore()
</script>

<template>
  <Button
    v-if="encrypt.unlocked"
    class="fixed right-4 bottom-4 z-40 rounded-full shadow-lg"
    size="sm"
    variant="secondary"
    @click="encrypt.lock()"
  >
    {{ t.lockNow }}
  </Button>
</template>
