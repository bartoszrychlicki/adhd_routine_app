import { parseBoolean, parseNumber } from "../_lib/validation"
import { parseIsoDate, assertDateRange } from "../_lib/dates"

export type FamilyProgressQuery = {
  date: string
  includeHistory: boolean
}

export function parseFamilyProgressQuery(
  searchParams: URLSearchParams
): FamilyProgressQuery {
  const date = parseIsoDate(searchParams.get("date"), "date") ??
    new Date().toISOString().slice(0, 10)

  const includeHistory = parseBoolean(
    searchParams.get("includeHistory"),
    false
  )

  return { date, includeHistory }
}

export type FamilyProgressHistoryQuery = {
  page: number
  pageSize: number
  fromDate?: string
  toDate?: string
}

export function parseFamilyProgressHistoryQuery(
  searchParams: URLSearchParams
): FamilyProgressHistoryQuery {
  const page = parseNumber(searchParams.get("page"), {
    fallback: 1,
    min: 1
  })

  const pageSize = parseNumber(searchParams.get("pageSize"), {
    fallback: 10,
    min: 1,
    max: 30
  })

  const fromDate = parseIsoDate(searchParams.get("fromDate"), "fromDate")
  const toDate = parseIsoDate(searchParams.get("toDate"), "toDate")

  assertDateRange(fromDate, toDate, { maxDays: 90 })

  return {
    page,
    pageSize,
    fromDate,
    toDate
  }
}
