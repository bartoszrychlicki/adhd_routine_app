import { ValidationError } from "./errors"

export function parseIsoDate(
  value: string | null | undefined,
  fieldName: string
): string | undefined {
  if (!value) {
    return undefined
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ValidationError(`Invalid date format for ${fieldName}`, {
      value
    })
  }

  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(`Invalid date for ${fieldName}`, { value })
  }

  return value
}

export function assertDateRange(
  from?: string,
  to?: string,
  options?: { maxDays?: number }
): void {
  if (from && to) {
    const fromDate = new Date(`${from}T00:00:00Z`)
    const toDate = new Date(`${to}T00:00:00Z`)

    if (fromDate.getTime() > toDate.getTime()) {
      throw new ValidationError("fromDate must be before toDate")
    }

    if (options?.maxDays) {
      const diffMs = toDate.getTime() - fromDate.getTime()
      const diffDays = diffMs / (1000 * 60 * 60 * 24)
      if (diffDays > options.maxDays) {
        throw new ValidationError("Date range exceeds allowed window", {
          maxDays: options.maxDays
        })
      }
    }
  }
}
