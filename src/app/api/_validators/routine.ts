import type {
  RoutineChildUpsertCommand,
  RoutineChildrenReorderCommand,
  RoutineCreateCommand,
  RoutineTaskCreateCommand,
  RoutineTaskReorderCommand,
  RoutineTaskUpdateCommand,
  RoutineUpdateCommand
} from "@/types"
import { ValidationError } from "../_lib/errors"
import { parseBoolean, parseNumber } from "../_lib/validation"

const routineTypes = new Set(["morning", "afternoon", "evening", "custom"])
const routineSortFields = new Set(["name", "createdAt"])
const taskSortFields = new Set(["position", "createdAt"])

function validateTime(value: unknown, field: string): string | null | undefined {
  if (typeof value === "undefined") {
    return undefined
  }

  if (value === null) {
    return null
  }

  if (typeof value !== "string") {
    throw new ValidationError(`${field} must be a string or null`)
  }

  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    throw new ValidationError(`${field} must be in HH:MM or HH:MM:SS format`)
  }

  return value.length === 5 ? `${value}:00` : value
}

function validateRoutineType(value: unknown): RoutineCreateCommand["routineType"] {
  if (typeof value !== "string" || !routineTypes.has(value)) {
    throw new ValidationError("Invalid routineType", { value })
  }
  return value as RoutineCreateCommand["routineType"]
}

function ensureNonEmpty(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`${field} must be a non-empty string`)
  }
  return value
}

function ensurePositiveInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new ValidationError(`${field} must be a positive integer`)
  }
  return value
}

function ensureNonNegativeInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new ValidationError(`${field} must be a non-negative integer`)
  }
  return value
}

function ensureSettings(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === "undefined") {
    return undefined
  }

  if (value === null) {
    return {}
  }

  if (typeof value !== "object") {
    throw new ValidationError("settings must be an object")
  }

  return value as Record<string, unknown>
}

export type RoutineListQuery = {
  routineType?: RoutineCreateCommand["routineType"]
  isActive: boolean | undefined
  includeDeleted: boolean
  page: number
  pageSize: number
  sort: "name" | "created_at"
  order: "asc" | "desc"
}

export function parseRoutineListQuery(
  searchParams: URLSearchParams
): RoutineListQuery {
  const routineTypeParam = searchParams.get("routineType") ?? undefined
  const routineType = routineTypeParam
    ? validateRoutineType(routineTypeParam)
    : undefined

  const isActiveParam = searchParams.get("isActive")
  const isActive =
    typeof isActiveParam === "string"
      ? parseBoolean(isActiveParam, true)
      : undefined

  const includeDeleted = parseBoolean(
    searchParams.get("includeDeleted"),
    false
  )

  const page = parseNumber(searchParams.get("page"), {
    fallback: 1,
    min: 1
  })

  const pageSize = parseNumber(searchParams.get("pageSize"), {
    fallback: 25,
    min: 1,
    max: 100
  })

  const sortParam = searchParams.get("sort") ?? "createdAt"
  if (!routineSortFields.has(sortParam)) {
    throw new ValidationError("Invalid sort parameter", { sort: sortParam })
  }

  const orderParam = searchParams.get("order") ?? "desc"
  if (orderParam !== "asc" && orderParam !== "desc") {
    throw new ValidationError("Invalid order parameter", { order: orderParam })
  }

  return {
    routineType,
    isActive,
    includeDeleted,
    page,
    pageSize,
    sort: sortParam === "name" ? "name" : "created_at",
    order: orderParam
  }
}

export function parseRoutineCreatePayload(
  payload: unknown
): RoutineCreateCommand {
  if (typeof payload !== "object" || payload === null) {
    throw new ValidationError("Request body must be a JSON object")
  }

  const record = payload as Record<string, unknown>
  const name = ensureNonEmpty(record.name, "name")
  const slug = ensureNonEmpty(record.slug, "slug")
  const routineType = validateRoutineType(record.routineType)
  const startTime = validateTime(record.startTime, "startTime")
  const endTime = validateTime(record.endTime, "endTime")

  if (startTime && endTime && startTime >= endTime) {
    throw new ValidationError("startTime must be before endTime")
  }

  let autoCloseAfterMinutes: number | undefined
  if (typeof record.autoCloseAfterMinutes !== "undefined") {
    autoCloseAfterMinutes = ensurePositiveInteger(
      Number(record.autoCloseAfterMinutes),
      "autoCloseAfterMinutes"
    )
  }

  const settings = ensureSettings(record.settings) ?? {}

  return {
    name,
    slug,
    routineType,
    startTime,
    endTime,
    autoCloseAfterMinutes,
    settings
  }
}

export function parseRoutineUpdatePayload(
  payload: unknown
): RoutineUpdateCommand {
  if (typeof payload !== "object" || payload === null) {
    throw new ValidationError("Request body must be a JSON object")
  }

  const record = payload as Record<string, unknown>

  const command: RoutineUpdateCommand = {}

  if (Object.prototype.hasOwnProperty.call(record, "name")) {
    command.name = ensureNonEmpty(record.name, "name")
  }

  if (Object.prototype.hasOwnProperty.call(record, "slug")) {
    command.slug = ensureNonEmpty(record.slug, "slug")
  }

  if (Object.prototype.hasOwnProperty.call(record, "routineType")) {
    command.routineType = validateRoutineType(record.routineType)
  }

  if (Object.prototype.hasOwnProperty.call(record, "startTime")) {
    command.startTime = validateTime(record.startTime, "startTime") ?? null
  }

  if (Object.prototype.hasOwnProperty.call(record, "endTime")) {
    command.endTime = validateTime(record.endTime, "endTime") ?? null
  }

  if (Object.prototype.hasOwnProperty.call(record, "autoCloseAfterMinutes")) {
    if (record.autoCloseAfterMinutes === null) {
      command.autoCloseAfterMinutes = null
    } else {
      command.autoCloseAfterMinutes = ensurePositiveInteger(
        Number(record.autoCloseAfterMinutes),
        "autoCloseAfterMinutes"
      )
    }
  }

  if (Object.prototype.hasOwnProperty.call(record, "settings")) {
    command.settings = ensureSettings(record.settings) ?? {}
  }

  if (Object.prototype.hasOwnProperty.call(record, "isActive")) {
    command.isActive = Boolean(record.isActive)
  }

  if (Object.keys(command).length === 0) {
    throw new ValidationError("No fields provided to update")
  }

  if (command.startTime && command.endTime && command.startTime >= command.endTime) {
    throw new ValidationError("startTime must be before endTime")
  }

  return command
}

export function parseChildRoutineAssignmentPayload(
  payload: unknown
): RoutineChildUpsertCommand {
  if (typeof payload !== "object" || payload === null) {
    throw new ValidationError("Request body must be a JSON object")
  }

  const record = payload as Record<string, unknown>
  const positionValue = record.position

  if (typeof positionValue !== "number" || !Number.isInteger(positionValue) || positionValue <= 0) {
    throw new ValidationError("position must be a positive integer")
  }

  return {
    position: positionValue,
    isEnabled: Boolean(record.isEnabled ?? true)
  }
}

export function parseChildRoutineReorderPayload(
  payload: unknown
): RoutineChildrenReorderCommand {
  if (typeof payload !== "object" || payload === null) {
    throw new ValidationError("Request body must be a JSON object")
  }

  const record = payload as Record<string, unknown>
  const orders = record.orders

  if (!Array.isArray(orders) || orders.length === 0) {
    throw new ValidationError("orders must be a non-empty array")
  }

  const entries = orders.map((entry) => {
    if (typeof entry !== "object" || entry === null) {
      throw new ValidationError("orders entries must be objects")
    }

    const { childProfileId, position } = entry as Record<string, unknown>

    if (typeof childProfileId !== "string") {
      throw new ValidationError("childProfileId must be a string")
    }

    if (typeof position !== "number" || !Number.isInteger(position) || position <= 0) {
      throw new ValidationError("position must be a positive integer")
    }

    return { childProfileId, position }
  })

  return { orders: entries }
}

export type RoutineTaskListQuery = {
  includeInactive: boolean
  sort: "position" | "created_at"
  order: "asc" | "desc"
}

export function parseTaskListQuery(
  searchParams: URLSearchParams
): RoutineTaskListQuery {
  const includeInactive = parseBoolean(
    searchParams.get("includeInactive"),
    false
  )

  const sortParam = searchParams.get("sort") ?? "position"
  if (!taskSortFields.has(sortParam)) {
    throw new ValidationError("Invalid sort parameter", { sort: sortParam })
  }

  const orderParam = searchParams.get("order") ?? "asc"
  if (orderParam !== "asc" && orderParam !== "desc") {
    throw new ValidationError("Invalid order parameter", { order: orderParam })
  }

  return {
    includeInactive,
    sort: sortParam === "createdAt" ? "created_at" : "position",
    order: orderParam
  }
}

export function parseTaskCreatePayload(
  payload: unknown
): RoutineTaskCreateCommand {
  if (typeof payload !== "object" || payload === null) {
    throw new ValidationError("Request body must be a JSON object")
  }

  const record = payload as Record<string, unknown>

  const name = ensureNonEmpty(record.name, "name")
  const description =
    typeof record.description === "string" ? record.description : null
  const points = ensureNonNegativeInteger(Number(record.points ?? 0), "points")
  const position = ensurePositiveInteger(Number(record.position ?? 0), "position")
  const isOptional = Boolean(record.isOptional ?? false)

  let expectedDurationSeconds: number | null = null
  if (typeof record.expectedDurationSeconds !== "undefined") {
    const value = Number(record.expectedDurationSeconds)
    if (!Number.isInteger(value) || value <= 0) {
      throw new ValidationError("expectedDurationSeconds must be positive")
    }
    expectedDurationSeconds = value
  }

  return {
    name,
    description,
    points,
    position,
    isOptional,
    expectedDurationSeconds
  }
}

export function parseTaskUpdatePayload(
  payload: unknown
): RoutineTaskUpdateCommand {
  if (typeof payload !== "object" || payload === null) {
    throw new ValidationError("Request body must be a JSON object")
  }

  const record = payload as Record<string, unknown>
  const command: RoutineTaskUpdateCommand = {}

  if (Object.prototype.hasOwnProperty.call(record, "name")) {
    command.name = ensureNonEmpty(record.name, "name")
  }

  if (Object.prototype.hasOwnProperty.call(record, "description")) {
    command.description =
      typeof record.description === "string" ? record.description : null
  }

  if (Object.prototype.hasOwnProperty.call(record, "points")) {
    command.points = ensureNonNegativeInteger(Number(record.points), "points")
  }

  if (Object.prototype.hasOwnProperty.call(record, "position")) {
    command.position = ensurePositiveInteger(
      Number(record.position),
      "position"
    )
  }

  if (Object.prototype.hasOwnProperty.call(record, "isOptional")) {
    command.isOptional = Boolean(record.isOptional)
  }

  if (Object.prototype.hasOwnProperty.call(record, "isActive")) {
    command.isActive = Boolean(record.isActive)
  }

  if (Object.prototype.hasOwnProperty.call(record, "expectedDurationSeconds")) {
    if (record.expectedDurationSeconds === null) {
      command.expectedDurationSeconds = null
    } else {
      const value = Number(record.expectedDurationSeconds)
      if (!Number.isInteger(value) || value <= 0) {
        throw new ValidationError("expectedDurationSeconds must be positive")
      }
      command.expectedDurationSeconds = value
    }
  }

  if (Object.prototype.hasOwnProperty.call(record, "deletedAt")) {
    if (record.deletedAt === null) {
      command.deletedAt = null
    } else if (typeof record.deletedAt === "string") {
      if (Number.isNaN(Date.parse(record.deletedAt))) {
        throw new ValidationError("deletedAt must be a valid ISO string")
      }
      command.deletedAt = record.deletedAt
    } else {
      throw new ValidationError("deletedAt must be string or null")
    }
  }

  if (Object.keys(command).length === 0) {
    throw new ValidationError("No fields provided to update")
  }

  return command
}

export function parseTaskReorderPayload(
  payload: unknown
): RoutineTaskReorderCommand {
  if (typeof payload !== "object" || payload === null) {
    throw new ValidationError("Request body must be a JSON object")
  }

  const record = payload as Record<string, unknown>
  const orders = record.orders

  if (!Array.isArray(orders) || orders.length === 0) {
    throw new ValidationError("orders must be a non-empty array")
  }

  const routineId = ensureNonEmpty(record.routineId, "routineId")
  const childProfileId = ensureNonEmpty(
    record.childProfileId,
    "childProfileId"
  )

  const entries = orders.map((entry) => {
    if (typeof entry !== "object" || entry === null) {
      throw new ValidationError("orders entries must be objects")
    }

    const { taskId, position } = entry as Record<string, unknown>

    if (typeof taskId !== "string") {
      throw new ValidationError("taskId must be a string")
    }

    if (typeof position !== "number" || !Number.isInteger(position) || position <= 0) {
      throw new ValidationError("position must be a positive integer")
    }

    return { taskId, position }
  })

  return {
    routineId,
    childProfileId,
    orders: entries
  }
}
