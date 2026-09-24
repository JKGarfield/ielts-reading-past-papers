import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules() })

describe('static deployment', () => {
  it('blocks backend calls even if an API is invoked directly, while auth remains a guest', async () => {
    vi.stubEnv('VITE_STATIC_MODE', 'true')
    vi.resetModules()
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const assistant = await import('@/api/assistant')
    const auth = await import('@/api/authSync')
    const { loadContactAdConfig } = await import('@/api/contactAd')
    const { useAuthStore } = await import('@/store/authStore')
    const { syncNow, bootstrapSyncAfterAuth } = await import('@/sync/syncManager')
    setActivePinia(createPinia())
    await assistant.loadAssistantPublicConfig()
    await expect(assistant.queryPracticeAssistant({} as never)).rejects.toThrow('unavailable')
    await expect(assistant.queryPracticeAssistantStream({} as never).next()).rejects.toThrow('unavailable')
    await expect(auth.getCurrentSession()).rejects.toMatchObject({ code: 'static_mode' })
    await expect(auth.pullSyncSnapshot()).rejects.toMatchObject({ code: 'static_mode' })
    await expect(loadContactAdConfig()).resolves.toMatchObject({ markdown: '' })
    await useAuthStore().bootstrapSession()
    await syncNow()
    await bootstrapSyncAfterAuth()
    expect(useAuthStore().status).toBe('guest')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('hides account, sponsor and assistant controls on static pages', async () => {
    vi.stubEnv('VITE_STATIC_MODE', 'true')
    vi.resetModules()
    const { mount } = await import('@vue/test-utils')
    const { createMemoryHistory, createRouter } = await import('vue-router')
    const { ref } = await import('vue')
    const { default: MainLayout } = await import('@/layouts/MainLayout.vue')
    const { default: PracticeMode } = await import('@/views/PracticeMode.vue')
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/practice-mode', component: PracticeMode }] })
    await router.push('/practice-mode?id=p1-high-01')
    await router.isReady()
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const options = { global: {
      plugins: [pinia, router],
      provide: { currentLang: ref('zh'), t: (key: string) => key },
      stubs: { RouterView: true, PracticeAssistant: true, PracticeNodeRenderer: true, SponsorContactAd: true, 'a-modal': true }
    } }
    const layout = mount(MainLayout, options)
    const practice = mount(PracticeMode, options)
    try {
      await vi.waitFor(() => expect(practice.find('.practice-page').exists() || practice.text().includes('A Brief History of Tea')).toBe(true))
      expect(layout.find('[data-testid="account-entry"]').exists()).toBe(false)
      expect(layout.find('[data-testid="sponsor-contact-action"]').exists()).toBe(false)
      expect(layout.find('sponsor-contact-ad-stub').exists()).toBe(false)
      expect(layout.find('a[href="/open-source.html"]').exists()).toBe(true)
      expect(practice.find('practice-assistant-stub').exists()).toBe(false)
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally { practice.unmount(); layout.unmount() }
  })

  it('disables inherited tracking even when explicitly enabled', async () => {
    vi.stubEnv('VITE_STATIC_MODE', 'true')
    vi.resetModules()
    const { isBaiduTongjiEnabled } = await import('@/analytics/baiduTongji')
    expect(isBaiduTongjiEnabled({ enabled: true, siteId: 'upstream-tracking' })).toBe(false)
  })

  it('leaves the normal deployment enabled by default', async () => {
    vi.stubEnv('VITE_STATIC_MODE', '')
    vi.resetModules()
    const { isStaticMode } = await import('./deployment')
    expect(isStaticMode).toBe(false)
    const { isBaiduTongjiEnabled } = await import('@/analytics/baiduTongji')
    expect(isBaiduTongjiEnabled({ enabled: true, siteId: 'own-site' })).toBe(true)
  })
})
