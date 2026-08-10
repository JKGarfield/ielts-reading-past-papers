import type { PracticeRecord } from '@/store/practiceStore'

export const PRACTICE_HISTORY_PAGE_SIZES = [10, 20, 50, 100] as const

export type PracticeHistoryCategory = 'all' | 'P1' | 'P2' | 'P3'

export interface PracticeHistoryRouteState {
  search: string
  category: PracticeHistoryCategory
  page: number
  pageSize: number
}

type QueryLike = Record<string, unknown>

function queryString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function positiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(queryString(value))
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function historyCategory(value: unknown): PracticeHistoryCategory {
  const normalized = queryString(value).trim().toUpperCase()
  return normalized === 'P1' || normalized === 'P2' || normalized === 'P3'
    ? normalized
    : 'all'
}

export function parsePracticeHistoryQuery(query: QueryLike): PracticeHistoryRouteState {
  const parsedPageSize = positiveInteger(query.pageSize, 10)
  return {
    search: queryString(query.search).trim(),
    category: historyCategory(query.category),
    page: positiveInteger(query.page, 1),
    pageSize: PRACTICE_HISTORY_PAGE_SIZES.includes(parsedPageSize as typeof PRACTICE_HISTORY_PAGE_SIZES[number])
      ? parsedPageSize
      : 10
  }
}

export function buildPracticeHistoryQuery(state: PracticeHistoryRouteState): Record<string, string> {
  const query: Record<string, string> = {}
  const search = state.search.trim()

  if (search) {
    query.search = search
  }
  if (state.category !== 'all') {
    query.category = state.category
  }

  query.page = String(Math.max(1, Math.trunc(state.page) || 1))
  query.pageSize = String(
    PRACTICE_HISTORY_PAGE_SIZES.includes(state.pageSize as typeof PRACTICE_HISTORY_PAGE_SIZES[number])
      ? state.pageSize
      : 10
  )
  return query
}

export function getPracticeHistoryReturnQuery(query: QueryLike): Record<string, string> {
  return buildPracticeHistoryQuery(parsePracticeHistoryQuery(query))
}

export function canReviewPracticeRecord(record: PracticeRecord | null | undefined): boolean {
  return Boolean(record?.id && (record?.resultSnapshot?.metadata?.examId || record?.questionId) && record?.resultSnapshot)
}

export function buildPracticeReviewRoute(record: PracticeRecord, historyQuery?: QueryLike) {
  const returnQuery = historyQuery
    ? {
        from: 'practice',
        ...getPracticeHistoryReturnQuery(historyQuery)
      }
    : {}

  return {
    path: '/practice-mode',
    query: {
      id: record.resultSnapshot?.metadata?.examId || record.questionId,
      mode: 'review',
      recordId: record.id,
      ...returnQuery
    }
  }
}
