import type { ManualPointTransactionCommand } from "@/types"
import { ValidationError } from "../_lib/errors"
import { parseBoolean, parseNumber } from "../_lib/validation"
import { parseIsoDate } from "../_lib/dates"

const allowedTransactionTypes = new Set([
  "task_completion",
  "routine_bonus",
  "manual_adjustment",
  "reward_redeem"
])

export type TransactionsQuery = {
  childProfileId?: string
  transactionType?: string
  from?: string
  to?: string
  page: number
  pageSize: number
  sort: "created_at" | "points_delta"
  order: "asc" | "desc"
}

export function parseTransactionsQuery(
  searchParams: URLSearchParams
): TransactionsQuery {
  const childProfileId = searchParams.get("childProfileId") ?? undefined
  const transactionType = searchParams.get("transactionType") ?? undefined

  if (transactionType && !allowedTransactionTypes.has(transactionType)) {
    throw new ValidationError("Invalid transactionType filter")
  }

  const from = parseIsoDate(searchParams.get("from"), "from")
  const to = parseIsoDate(searchParams.get("to"), "to")

  const page = parseNumber(searchParams.get("page"), {
    fallback: 1,
    min: 1
  })

  const pageSize = parseNumber(searchParams.get("pageSize"), {
    fallback: 25,
    min: 1,
    max: 100
  })

  const sortParam = searchParams.get("sort") ?? "created_at"
  if (sortParam !== "created_at" && sortParam !== "points_delta") {
    throw new ValidationError("Invalid sort parameter")
  }

  const orderParam = searchParams.get("order") ?? "desc"
  if (orderParam !== "asc" && orderParam !== "desc") {
    throw new ValidationError("Invalid order parameter")
  }

  return {
    childProfileId,
    transactionType,
    from,
    to,
    page,
    pageSize,
    sort: sortParam as "created_at" | "points_delta",
    order: orderParam
  }
}

export function parseManualTransactionPayload(
  payload: unknown
): ManualPointTransactionCommand {
  if (typeof payload !== "object" || payload === null) {
    throw new ValidationError("Request body must be a JSON object")
  }

  const record = payload as Record<string, unknown>

  const profileId = record.profileId
  if (typeof profileId !== "string") {
    throw new ValidationError("profileId is required")
  }

  const pointsDeltaValue = Number(record.pointsDelta)
  if (!Number.isInteger(pointsDeltaValue)) {
    throw new ValidationError("pointsDelta must be an integer")
  }

  const reason = record.reason
  if (typeof reason !== "string" || reason.trim().length === 0) {
    throw new ValidationError("reason must be a non-empty string")
  }

  return {
    profileId,
    pointsDelta: pointsDeltaValue,
    reason
  }
}

export type WalletQuery = {
  includeTransactions: boolean
  transactionsLimit: number
}

export function parseWalletQuery(
  searchParams: URLSearchParams
): WalletQuery {
  const includeTransactions = parseBoolean(
    searchParams.get("includeTransactions"),
    true
  )

  const transactionsLimit = parseNumber(
    searchParams.get("transactionsLimit"),
    { fallback: 5, min: 1, max: 20 }
  )

  return {
    includeTransactions,
    transactionsLimit
  }
}
