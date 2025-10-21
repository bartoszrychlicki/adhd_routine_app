import type {
  CompleteRoutineSessionCommand,
  RoutineSessionCreateCommand,
  RoutineSessionSkipCommand,
  TaskCompletionCommand
} from "@/types"
import { ValidationError } from "../_lib/errors"
import { parseNumber } from "../_lib/validation"
import { parseIsoDate, assertDateRange } from "../_lib/dates"

const allowedSortFields = new Set(["sessionDate", "startedAt", "completedAt"])
const allowedStatus = new Set([
  "scheduled",
  "in_progress",
  "completed",
  "auto_closed",
  "skipped",
  "expired"
])

export type SessionListQuery = {
  status?: string
  fromDate?: string
  toDate?: string
  routineId?: string
  page: number
  pageSize: number
  sort: "session_date" | "started_at" | "completed_at"
  order: "asc" | "desc"
}

export function parseSessionListQuery(
  searchParams: URLSearchParams
): SessionListQuery {
  const statusParam = searchParams.get("status") ?? undefined
  if (statusParam && !allowedStatus.has(statusParam)) {
    throw new ValidationError("Invalid status filter", { status: statusParam })
  }

  const fromDate = parseIsoDate(searchParams.get("fromDate"), "fromDate")
  const toDate = parseIsoDate(searchParams.get("toDate"), "toDate")
  assertDateRange(fromDate, toDate, { maxDays: 31 })

  const routineId = searchParams.get("routineId") ?? undefined

  const page = parseNumber(searchParams.get("page"), {
    fallback: 1,
    min: 1
  })

  const pageSize = parseNumber(searchParams.get("pageSize"), {
    fallback: 25,
    min: 1,
    max: 100
  })

  const sortParam = searchParams.get("sort") ?? "sessionDate"
  if (!allowedSortFields.has(sortParam)) {
    throw new ValidationError("Invalid sort parameter", { sort: sortParam })
  }

  const orderParam = searchParams.get("order") ?? "desc"
  if (orderParam !== "asc" && orderParam !== "desc") {
    throw new ValidationError("Invalid order parameter", { order: orderParam })
  }

  const sortMap: Record<string, SessionListQuery["sort"]> = {
    sessionDate: "session_date",
    startedAt: "started_at",
    completedAt: "completed_at"
  }

  return {
    status: statusParam,
    fromDate,
    toDate,
    routineId,
    page,
    pageSize,
    sort: sortMap[sortParam],
    order: orderParam
  }
}

export function parseSessionCreatePayload(
  payload: unknown
): RoutineSessionCreateCommand {
  if (typeof payload !== "object" || payload === null) {
    throw new ValidationError("Request body must be a JSON object")
  }

  const record = payload as Record<string, unknown>

  const routineId = record.routineId
  if (typeof routineId !== "string" || routineId.length === 0) {
    throw new ValidationError("routineId is required")
  }

  const sessionDate = record.sessionDate
  if (typeof sessionDate !== "string") {
    throw new ValidationError("sessionDate must be YYYY-MM-DD")
  }
  parseIsoDate(sessionDate, "sessionDate")

  const autoStartTimer = record.autoStartTimer
  if (
    typeof autoStartTimer !== "undefined" &&
    typeof autoStartTimer !== "boolean"
  ) {
    throw new ValidationError("autoStartTimer must be boolean")
  }

  return {
    routineId,
    sessionDate,
    autoStartTimer: autoStartTimer ?? false
  }
}

export function parseTaskCompletionPayload(
  payload: unknown
): TaskCompletionCommand {
  if (typeof payload !== "object" || payload === null) {
    throw new ValidationError("Request body must be a JSON object")
  }

  const record = payload as Record<string, unknown>
  const completedAt = record.completedAt

  if (typeof completedAt !== "string") {
    throw new ValidationError("completedAt is required and must be ISO string")
  }

  if (Number.isNaN(Date.parse(completedAt))) {
    throw new ValidationError("completedAt must be a valid ISO date string")
  }

  const notes = record.notes
  if (typeof notes !== "undefined" && typeof notes !== "string") {
    throw new ValidationError("notes must be a string if provided")
  }

  return {
    completedAt,
    notes: typeof notes === "string" ? { note: notes } : undefined
  }
}

export function parseSessionCompletionPayload(
  payload: unknown
): CompleteRoutineSessionCommand {
  if (typeof payload !== "object" || payload === null) {
    throw new ValidationError("Request body must be a JSON object")
  }

  const record = payload as Record<string, unknown>

  const completedTasks = record.completedTasks
  if (!Array.isArray(completedTasks) || completedTasks.length === 0) {
    throw new ValidationError("completedTasks must be a non-empty array")
  }

  const tasks = completedTasks.map((entry) => {
    if (typeof entry !== "object" || entry === null) {
      throw new ValidationError("completedTasks entries must be objects")
    }

    const { taskId, completedAt } = entry as Record<string, unknown>

    if (typeof taskId !== "string") {
      throw new ValidationError("taskId must be a string")
    }

    if (typeof completedAt !== "string") {
      throw new ValidationError("completedAt must be a string")
    }

    if (Number.isNaN(Date.parse(completedAt))) {
      throw new ValidationError("completedAt must be a valid ISO string")
    }

    return { taskId, completedAt }
  })

  const bestTimeBeaten = record.bestTimeBeaten
  if (
    typeof bestTimeBeaten !== "undefined" &&
    typeof bestTimeBeaten !== "boolean"
  ) {
    throw new ValidationError("bestTimeBeaten must be boolean if provided")
  }

  return {
    completedTasks: tasks,
    bestTimeBeaten: bestTimeBeaten ?? false
  }
}

export function parseSessionSkipPayload(
  payload: unknown
): RoutineSessionSkipCommand {
  if (typeof payload !== "object" || payload === null) {
    throw new ValidationError("Request body must be a JSON object")
  }

  const record = payload as Record<string, unknown>
  const status = record.status

  if (status !== "skipped" && status !== "expired") {
    throw new ValidationError("status must be 'skipped' or 'expired'")
  }

  const reason = record.reason
  if (typeof reason !== "undefined" && typeof reason !== "string") {
    throw new ValidationError("reason must be a string")
  }

  return {
    status,
    reason: typeof reason === "string" ? reason : undefined
  }
}
