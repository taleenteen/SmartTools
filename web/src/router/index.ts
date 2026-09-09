import { createRouter, createWebHistory } from 'vue-router'

import HomeView from '@/views/HomeView.vue'
import MangaView from '@/views/MangaView.vue'
import NotesView from '@/views/NotesView.vue'
import SettingsLayout from '@/views/settings/SettingsLayout.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/manga',
      name: 'manga',
      component: MangaView,
    },
    {
      path: '/notes',
      name: 'notes',
      component: NotesView,
    },
    {
      path: '/n',
      redirect: '/notes',
    },
    {
      path: '/settings',
      name: 'settings',
      component: SettingsLayout,
    },
    {
      path: '/c',
      redirect: '/settings',
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'public-home',
      component: HomeView,
    },
  ],
})

export default router
