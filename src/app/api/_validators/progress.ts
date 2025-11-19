import { parseBoolean, parseNumber } from "../_lib/validation"
import { parseIsoDate, assertDateRange } from "../_lib/dates"
import { ValidationError } from "../_lib/errors"

export type FamilyProgressQuery = {
  date: string
  includeHistory: boolean
}

export function parseFamilyProgressQuery(
  searchParams: URLSearchParams
): FamilyProgressQuery {
  const todayIso = new Date().toISOString().slice(0, 10)
  const date = parseIsoDate(searchParams.get("date"), "date") ?? todayIso

  assertDailyProgressDateWindow(date, todayIso)

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

function assertDailyProgressDateWindow(date: string, todayIso: string) {
  const today = new Date(`${todayIso}T00:00:00Z`)
  const selected = new Date(`${date}T00:00:00Z`)

  if (selected.getTime() > today.getTime()) {
    throw new ValidationError("Date cannot be in the future", { field: "date" })
  }

  const earliest = new Date(today)
  earliest.setUTCDate(earliest.getUTCDate() - 30)

  if (selected.getTime() < earliest.getTime()) {
    throw new ValidationError("Date cannot be older than 30 days", {
      field: "date",
      maxDays: 30
    })
  }
}
