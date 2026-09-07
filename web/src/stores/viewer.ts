import { ref } from 'vue'
import { defineStore } from 'pinia'

import type { ViewerInfo } from '@/types/bookmark'

export const useViewerStore = defineStore('viewer', () => {
  const isAdminView = ref(true)
  const slug = ref<string | undefined>()
  const username = ref<string | undefined>()
  const role = ref<string | undefined>()

  function apply(info: ViewerInfo) {
    isAdminView.value = info.isAdminView
    slug.value = info.slug
    username.value = info.username
    role.value = info.role
  }

  return { isAdminView, slug, username, role, apply }
})
