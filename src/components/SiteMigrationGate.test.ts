import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import SiteMigrationGate from './SiteMigrationGate.vue'
import App from '@/App.vue'

vi.mock('@/layouts/MainLayout.vue', () => ({ default: { template: '<main><slot /></main>' } }))
vi.mock('@/views/Home.vue', () => ({ default: { template: '<div>Home preview</div>' } }))
vi.mock('@/store/themeStore', () => ({ useThemeStore: () => ({ initTheme: vi.fn() }) }))

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('standalone site retirement gate', () => {
  it('shows the requested notice and both links point to the new IELTS site', () => {
    wrapper = mount(SiteMigrationGate, { attachTo: document.body })
    expect(wrapper.get('dialog').attributes('open')).toBeDefined()
    expect(wrapper.text()).toContain('由于云资源有限，当前练习站已迁移至JK IELTS练习站，听/阅/写各类资源一网打尽。')
    expect(wrapper.get('.migration-primary').text()).toBe('前往新站点')
    expect(wrapper.findAll('a').map(a => a.attributes('href'))).toEqual([
      'https://jkielts.pages.dev/app/home',
      'https://jkielts.pages.dev/app/home'
    ])
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('rejects native dismissal, stays open after backdrop clicks and locks scrolling', async () => {
    document.documentElement.style.overflow = 'auto'
    wrapper = mount(SiteMigrationGate, { attachTo: document.body })
    const dialog = wrapper.get('dialog')
    const cancel = new Event('cancel', { cancelable: true })
    dialog.element.dispatchEvent(cancel)
    expect(cancel.defaultPrevented).toBe(true)
    await dialog.trigger('keydown', { key: 'Escape' })
    await dialog.trigger('click')
    expect(dialog.attributes('open')).toBeDefined()
    expect(dialog.attributes('closedby')).toBe('none')
    expect(document.documentElement.style.overflow).toBe('hidden')
    wrapper.unmount()
    wrapper = undefined
    expect(document.documentElement.style.overflow).toBe('auto')
    document.documentElement.style.overflow = ''
  })

  it('never mounts a route component and makes the homepage backdrop inert', () => {
    const routeMounted = vi.fn()
    wrapper = mount(App, {
      attachTo: document.body,
      global: { stubs: { RouterView: { setup: routeMounted, template: '<div>Exam route</div>' } } }
    })
    expect(wrapper.get('.retired-site-background').attributes('inert')).toBeDefined()
    expect(wrapper.get('.retired-site-background').attributes('aria-hidden')).toBe('true')
    expect(wrapper.text()).toContain('Home preview')
    expect(routeMounted).not.toHaveBeenCalled()
    expect(wrapper.get('dialog').attributes('open')).toBeDefined()
  })
})
