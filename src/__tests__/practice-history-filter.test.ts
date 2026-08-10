import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import PracticeView from '@/views/Practice.vue'
import { usePracticeStore, type PracticeRecord } from '@/store/practiceStore'

const mocks = vi.hoisted(() => ({
  pushMock: vi.fn(),
  replaceMock: vi.fn(),
  route: {
    query: {} as Record<string, unknown>
  }
}))

vi.mock('vue-router', () => ({
  useRoute: () => mocks.route,
  useRouter: () => ({
    push: mocks.pushMock,
    replace: mocks.replaceMock
  })
}))

vi.mock('ant-design-vue', () => ({
  message: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn()
  }
}))

function practiceRecord(overrides: Partial<PracticeRecord> = {}): PracticeRecord {
  return {
    id: 'record-1',
    questionId: 'p1-high-05',
    questionTitle: 'Katherine Mansfield',
    category: 'P1',
    time: 1710000000000,
    duration: 90,
    correctAnswers: 7,
    totalQuestions: 13,
    accuracy: 54,
    score: 7,
    ...overrides
  }
}

describe('practice history search and category filters', () => {
  let backingStore: Record<string, string>
  let seededRecords: PracticeRecord[]

  beforeEach(() => {
    setActivePinia(createPinia())
    backingStore = {}
    seededRecords = []
    mocks.pushMock.mockReset()
    mocks.replaceMock.mockReset()
    mocks.route.query = {}

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => backingStore[key] ?? null)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      backingStore[key] = String(value)
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key) => {
      delete backingStore[key]
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  function seedRecords(records: PracticeRecord[]) {
    seededRecords = records
    backingStore.ielts_practice = JSON.stringify(records)
  }

  async function mountView(query: Record<string, unknown> = {}) {
    mocks.route.query = { ...query }
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(PracticeView, {
      global: {
        plugins: [pinia],
        provide: {
          t: (key: string, params?: Record<string, string | number>) => {
            if (key === 'practice.matchingRecords') {
              return `${params?.count}/${params?.total}`
            }
            if (key === 'practice.pageInfo') {
              return `${params?.current}/${params?.total}`
            }
            return key
          },
          currentLang: ref<'zh' | 'en'>('zh')
        }
      }
    })
    usePracticeStore().records = [...seededRecords]
    await nextTick()
    return wrapper
  }

  it('matches English titles case-insensitively and preserves duplicate attempts', async () => {
    seedRecords([
      practiceRecord({ id: 'record-1' }),
      practiceRecord({ id: 'record-2', time: 1710000001000 }),
      practiceRecord({ id: 'record-3', questionId: 'p2-high-09', questionTitle: 'A New Ice Age', category: 'P2' })
    ])
    const wrapper = await mountView()

    await wrapper.get('[data-testid="practice-history-search"]').setValue('kAtHeRiNe')
    await nextTick()

    expect(wrapper.findAll('.timeline-item')).toHaveLength(2)
    expect(wrapper.text()).toContain('Katherine Mansfield')
    expect(wrapper.text()).not.toContain('A New Ice Age')
  })

  it('matches Chinese question titles from question metadata and question ids', async () => {
    seedRecords([
      practiceRecord(),
      practiceRecord({ id: 'record-2', questionId: 'p2-high-09', questionTitle: 'A New Ice Age', category: 'P2' })
    ])
    const wrapper = await mountView()
    const search = wrapper.get('[data-testid="practice-history-search"]')

    await search.setValue('新西兰作家')
    await nextTick()
    expect(wrapper.findAll('.timeline-item')).toHaveLength(1)
    expect(wrapper.text()).toContain('Katherine Mansfield')

    await search.setValue('P2-HIGH-09')
    await nextTick()
    expect(wrapper.findAll('.timeline-item')).toHaveLength(1)
    expect(wrapper.text()).toContain('A New Ice Age')
  })

  it('combines category and search filters and infers legacy categories', async () => {
    seedRecords([
      practiceRecord(),
      practiceRecord({ id: 'record-2', questionId: 'p2-high-09', questionTitle: 'A New Ice Age', category: '' }),
      practiceRecord({ id: 'record-3', questionId: 'p3-custom-9999', questionTitle: 'Legacy P3 record', category: '' })
    ])
    const wrapper = await mountView()
    const category = wrapper.get('[data-testid="practice-history-category"]')
    const search = wrapper.get('[data-testid="practice-history-search"]')

    await category.setValue('P2')
    await search.setValue('ice')
    await nextTick()
    expect(wrapper.findAll('.timeline-item')).toHaveLength(1)
    expect(wrapper.text()).toContain('A New Ice Age')

    await category.setValue('P3')
    await search.setValue('legacy')
    await nextTick()
    expect(wrapper.findAll('.timeline-item')).toHaveLength(1)
    expect(wrapper.text()).toContain('Legacy P3 record')
  })

  it('keeps global statistics unchanged while filtering the list', async () => {
    seedRecords([
      practiceRecord(),
      practiceRecord({ id: 'record-2', questionId: 'p2-high-09', questionTitle: 'A New Ice Age', category: 'P2' }),
      practiceRecord({ id: 'record-3', questionId: 'p3-high-03', questionTitle: 'Third record', category: 'P3' })
    ])
    const wrapper = await mountView()

    await wrapper.get('[data-testid="practice-history-search"]').setValue('Katherine')
    await nextTick()

    expect(wrapper.findAll('.timeline-item')).toHaveLength(1)
    const statValues = wrapper.findAll('.stat-value')
    expect(statValues[0].text()).toBe('3')
    expect(statValues[3].text()).toBe('3')
    expect(wrapper.get('[data-testid="practice-history-result-count"]').text()).toBe('1/3')
  })

  it('shows distinct empty states and resets active filters', async () => {
    const emptyWrapper = await mountView()
    expect(emptyWrapper.text()).toContain('practice.noRecords')
    expect(emptyWrapper.find('[data-testid="practice-history-filter-panel"]').exists()).toBe(false)
    emptyWrapper.unmount()

    seedRecords([practiceRecord()])
    const filteredWrapper = await mountView()
    await filteredWrapper.get('[data-testid="practice-history-search"]').setValue('not-found')
    await nextTick()

    expect(filteredWrapper.get('[data-testid="practice-history-filter-empty"]').text()).toContain('practice.noMatchingRecords')
    await filteredWrapper.get('[data-testid="practice-history-reset"]').trigger('click')
    await nextTick()
    expect(filteredWrapper.findAll('.timeline-item')).toHaveLength(1)
  })

  it('restores valid URL state and paginates filtered records', async () => {
    seedRecords(Array.from({ length: 11 }, (_, index) => practiceRecord({
      id: `record-${index + 1}`,
      time: 1710000000000 + index
    })))
    const wrapper = await mountView({ search: 'Katherine', category: 'P1', page: '2', pageSize: '10' })
    await nextTick()

    expect((wrapper.get('[data-testid="practice-history-search"]').element as HTMLInputElement).value).toBe('Katherine')
    expect((wrapper.get('[data-testid="practice-history-category"]').element as HTMLSelectElement).value).toBe('P1')
    expect(wrapper.findAll('.timeline-item')).toHaveLength(1)
    expect(wrapper.get('[data-testid="practice-history-result-count"]').text()).toBe('11/11')
  })

  it('canonicalizes invalid URL values and syncs filter changes with router.replace', async () => {
    seedRecords([practiceRecord()])
    const wrapper = await mountView({ search: '   ', category: 'P9', page: '-4', pageSize: '999' })
    await nextTick()
    await nextTick()

    expect((wrapper.get('[data-testid="practice-history-category"]').element as HTMLSelectElement).value).toBe('all')
    expect((wrapper.get('[data-testid="practice-history-page-size"]').element as HTMLSelectElement).value).toBe('10')
    expect(mocks.replaceMock).toHaveBeenCalledWith({
      path: '/practice',
      query: { page: '1', pageSize: '10' }
    })

    mocks.replaceMock.mockClear()
    await wrapper.get('[data-testid="practice-history-search"]').setValue('  Katherine  ')
    await wrapper.get('[data-testid="practice-history-category"]').setValue('P1')
    await nextTick()

    expect(mocks.replaceMock).toHaveBeenLastCalledWith({
      path: '/practice',
      query: {
        search: 'Katherine',
        category: 'P1',
        page: '1',
        pageSize: '10'
      }
    })
  })

  it('carries the current history query into review mode', async () => {
    seedRecords([practiceRecord({
      resultSnapshot: {
        metadata: {
          examId: 'p1-high-05'
        }
      } as PracticeRecord['resultSnapshot']
    })])
    const wrapper = await mountView({ search: 'Katherine', category: 'P1', page: '1', pageSize: '20' })
    await nextTick()

    await wrapper.get('.timeline-item.reviewable').trigger('click')

    expect(mocks.pushMock).toHaveBeenCalledWith({
      path: '/practice-mode',
      query: {
        id: 'p1-high-05',
        mode: 'review',
        recordId: 'record-1',
        from: 'practice',
        search: 'Katherine',
        category: 'P1',
        page: '1',
        pageSize: '20'
      }
    })
  })
})
