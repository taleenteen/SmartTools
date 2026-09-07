import { describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import App from '../App.vue'
import HomeView from '../views/HomeView.vue'

describe('App', () => {
  it('renders the bookmark shell', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'home', component: HomeView },
        { path: '/settings', name: 'settings', component: HomeView },
        { path: '/t', name: 'tools', component: HomeView },
      ],
    })
    await router.push('/')
    await router.isReady()

    const wrapper = mount(App, {
      global: {
        plugins: [router, pinia],
      },
    })

    expect(wrapper.text()).toContain('Bookmarks')
  })
})
