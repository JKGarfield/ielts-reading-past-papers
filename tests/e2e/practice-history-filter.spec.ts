import { expect, test, type Page } from '@playwright/test'

function resultSnapshot(examId: string, category: string) {
  return {
    answers: {},
    answerComparison: {},
    correctAnswers: {},
    scoreInfo: {
      correct: 7,
      total: 13,
      totalQuestions: 13,
      accuracy: 54,
      percentage: 54,
      details: {},
      source: 'native_vue_practice'
    },
    metadata: {
      examId,
      examTitle: 'Katherine Mansfield',
      category,
      frequency: 'high',
      type: 'reading',
      practiceMode: 'single',
      markedQuestions: [],
      highlights: []
    }
  }
}

function practiceRecords() {
  const p1Records = Array.from({ length: 11 }, (_, index) => ({
    id: `p1-record-${index + 1}`,
    questionId: 'p1-high-05',
    questionTitle: 'Katherine Mansfield',
    category: 'P1',
    time: 1710000000000 + index,
    duration: 90,
    correctAnswers: 7,
    totalQuestions: 13,
    accuracy: 54,
    score: 7,
    resultSnapshot: resultSnapshot('p1-high-05', 'P1')
  }))

  return [
    ...p1Records,
    {
      ...p1Records[0],
      id: 'p2-record-1',
      questionId: 'p2-high-09',
      questionTitle: 'A New Ice Age',
      category: 'P2',
      resultSnapshot: resultSnapshot('p2-high-09', 'P2')
    },
    {
      ...p1Records[0],
      id: 'p2-record-2',
      questionId: 'p2-high-09',
      questionTitle: 'A New Ice Age retry',
      category: 'P2',
      resultSnapshot: resultSnapshot('p2-high-09', 'P2')
    },
    {
      ...p1Records[0],
      id: 'p3-record-1',
      questionId: 'p3-high-03',
      questionTitle: 'The Nature of Genius',
      category: 'P3',
      resultSnapshot: resultSnapshot('p3-high-03', 'P3')
    }
  ]
}

async function seedPracticeHistory(page: Page) {
  const records = practiceRecords()
  await page.addInitScript(({ records }) => {
    localStorage.setItem('ielts_practice', JSON.stringify(records))
    localStorage.setItem('ielts-language', 'zh')
    localStorage.setItem('ielts_theme', 'light')
  }, { records })
}

test.describe('practice history search and category filters', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/contact-ad', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          title: '消息通知',
          updatedAt: '2026-08-10T00:00:00+08:00',
          markdown: '',
          html: ''
        })
      })
    })
    await seedPracticeHistory(page)
  })

  test('filters by English, Chinese, id and category while preserving URL state', async ({ page }) => {
    await page.goto('/practice', { waitUntil: 'networkidle' })

    const search = page.getByTestId('practice-history-search')
    const category = page.getByTestId('practice-history-category')

    await expect(search).toBeVisible()
    await search.fill('kAtHeRiNe')
    await expect(page.locator('.timeline-item')).toHaveCount(10)
    await expect(page).toHaveURL(/search=kAtHeRiNe/)

    await search.fill('新西兰作家')
    await expect(page.locator('.timeline-item')).toHaveCount(10)
    await expect(page.locator('.record-title').first()).toContainText('Katherine Mansfield')

    await search.fill('P2-HIGH-09')
    await expect(page.locator('.timeline-item')).toHaveCount(2)
    await expect(page.locator('.record-title').first()).toContainText('A New Ice Age')

    await category.selectOption('P1')
    await expect(page.getByTestId('practice-history-filter-empty')).toBeVisible()

    await search.fill('Katherine')
    await expect(page.locator('.timeline-item')).toHaveCount(10)
    await expect(page).toHaveURL(/category=P1/)

    await page.getByTestId('practice-history-search-clear').click()
    await expect(search).toHaveValue('')
    await expect(page.locator('.timeline-item')).toHaveCount(10)

    await search.fill('does-not-exist')
    await expect(page.getByTestId('practice-history-filter-empty')).toBeVisible()
    await page.getByTestId('practice-history-reset').click()
    await expect(search).toHaveValue('')
    await expect(category).toHaveValue('all')
    await expect(page.locator('.timeline-item')).toHaveCount(10)
  })

  test('restores pagination and returns from review with the same filters', async ({ page }) => {
    await page.goto('/practice?search=Katherine&category=P1&page=2&pageSize=10', { waitUntil: 'networkidle' })

    await expect(page.getByTestId('practice-history-search')).toHaveValue('Katherine')
    await expect(page.getByTestId('practice-history-category')).toHaveValue('P1')
    await expect(page.getByTestId('practice-history-page-size')).toHaveValue('10')
    await expect(page.locator('.timeline-item')).toHaveCount(1)

    await page.locator('.timeline-item.reviewable').click()
    await expect(page).toHaveURL(/\/practice-mode\?.*from=practice/)
    await expect(page.locator('.practice-mode-page .page-header .icon-btn').first()).toBeVisible({ timeout: 60000 })
    await page.locator('.practice-mode-page .page-header .icon-btn').first().click()

    await expect(page).toHaveURL(/\/practice\?.*search=Katherine/)
    await expect(page).toHaveURL(/category=P1/)
    await expect(page).toHaveURL(/page=2/)
    await expect(page.getByTestId('practice-history-search')).toHaveValue('Katherine')
    await expect(page.locator('.timeline-item')).toHaveCount(1)
  })

  test('keeps mobile controls within the viewport and deletion isolated from review navigation', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    page.on('dialog', (dialog) => dialog.accept())
    await page.goto('/practice', { waitUntil: 'networkidle' })

    await expect(page.getByTestId('practice-history-filter-panel')).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)

    const originalUrl = page.url()
    await page.locator('.record-delete-button').first().click()
    await expect(page.locator('.timeline-item')).toHaveCount(10)
    expect(page.url()).toBe(originalUrl)
  })
})
