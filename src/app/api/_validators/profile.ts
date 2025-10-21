import type {
  CreateChildProfileCommand,
  ChildAccessTokenCreateCommand,
  ProfilePinUpdateCommand,
  ProfileUpdateCommand
} from "@/types"
import { ValidationError } from "../_lib/errors"
import { parseBoolean, parseNumber } from "../_lib/validation"

const allowedRoles = new Set(["parent", "child", "admin"])
const allowedSort = new Set(["createdAt", "displayName"])
const sortColumnMap: Record<string, "created_at" | "display_name"> = {
  createdAt: "created_at",
  displayName: "display_name"
}

export type ProfilesListQuery = {
  role?: string
  includeDeleted: boolean
  page: number
  pageSize: number
  sort: "created_at" | "display_name"
  order: "asc" | "desc"
}

export function parseProfilesListQuery(
  searchParams: URLSearchParams
): ProfilesListQuery {
  const role = searchParams.get("role") || undefined
  if (role && !allowedRoles.has(role)) {
    throw new ValidationError("Invalid role filter", { role })
  }

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

  const sortParam = searchParams.get("sort") || "createdAt"
  if (!allowedSort.has(sortParam)) {
    throw new ValidationError("Invalid sort parameter", { sort: sortParam })
  }

  const orderParam = searchParams.get("order") || "desc"
  if (orderParam !== "asc" && orderParam !== "desc") {
    throw new ValidationError("Invalid order parameter", { order: orderParam })
  }

  return {
    role,
    includeDeleted,
    page,
    pageSize,
    sort: sortColumnMap[sortParam],
    order: orderParam
  }
}

function ensureStringField(value: unknown, field: string): string | undefined {
  if (typeof value === "undefined") {
    return undefined
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`${field} must be a non-empty string`)
  }

  return value
}

function ensureOptionalString(value: unknown, field: string): string | undefined {
  if (typeof value === "undefined" || value === null) {
    return undefined
  }

  if (typeof value !== "string") {
    throw new ValidationError(`${field} must be a string`)
  }

  return value
}

function ensureSettings(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === "undefined") {
    return undefined
  }

  if (value === null) {
    return {} as Record<string, unknown>
  }

  if (typeof value !== "object") {
    throw new ValidationError("settings must be an object")
  }

  return value as Record<string, unknown>
}

export function parseCreateChildProfilePayload(
  payload: unknown
): CreateChildProfileCommand {
  if (typeof payload !== "object" || payload === null) {
    throw new ValidationError("Request body must be a JSON object")
  }

  const record = payload as Record<string, unknown>

  const displayName = ensureStringField(record.displayName, "displayName")
  if (!displayName) {
    throw new ValidationError("displayName is required")
  }

  const role = record.role ?? "child"
  if (role !== "child") {
    throw new ValidationError("Only child profiles can be created via this endpoint")
  }

  const email = ensureOptionalString(record.email, "email")
  const avatarUrl = ensureOptionalString(record.avatarUrl, "avatarUrl")
  const settings = ensureSettings(record.settings)

  const pinValue = ensureOptionalString(record.pin, "pin")
  if (pinValue && !/^\d{4,6}$/.test(pinValue)) {
    throw new ValidationError("PIN must be 4-6 digits")
  }

  return {
    displayName,
    role: "child",
    email,
    avatarUrl,
    pin: pinValue ?? null,
    settings
  }
}

export function parseProfileUpdatePayload(
  payload: unknown
): ProfileUpdateCommand {
  if (typeof payload !== "object" || payload === null) {
    throw new ValidationError("Request body must be a JSON object")
  }

  const record = payload as Record<string, unknown>

  const displayName = ensureOptionalString(record.displayName, "displayName")
  const avatarUrl = ensureOptionalString(record.avatarUrl, "avatarUrl")
  const settings = ensureSettings(record.settings)

  let deletedAt: string | null | undefined
  if (Object.prototype.hasOwnProperty.call(record, "deletedAt")) {
    const value = record.deletedAt
    if (value === null) {
      deletedAt = null
    } else if (typeof value === "string") {
      if (Number.isNaN(Date.parse(value))) {
        throw new ValidationError("deletedAt must be a valid ISO date-time string")
      }
      deletedAt = value
    } else {
      throw new ValidationError("deletedAt must be a string or null")
    }
  }

  if (
    typeof displayName === "undefined" &&
    typeof avatarUrl === "undefined" &&
    typeof settings === "undefined" &&
    typeof deletedAt === "undefined"
  ) {
    throw new ValidationError("At least one field must be provided for update")
  }

  return {
    displayName,
    avatarUrl,
    settings,
    deletedAt
  }
}

export function parseProfilePinPayload(
  payload: unknown
): ProfilePinUpdateCommand {
  if (typeof payload !== "object" || payload === null) {
    throw new ValidationError("Request body must be a JSON object")
  }

  const record = payload as Record<string, unknown>
  const pin = ensureStringField(record.pin, "pin")

  if (!pin) {
    throw new ValidationError("pin is required")
  }

  if (!/^\d{4,6}$/.test(pin)) {
    throw new ValidationError("PIN must be 4-6 digits")
  }

  const rotateTokens = record.rotateTokens
  if (
    typeof rotateTokens !== "undefined" &&
    typeof rotateTokens !== "boolean"
  ) {
    throw new ValidationError("rotateTokens must be a boolean")
  }

  return {
    pin,
    rotateTokens: rotateTokens ?? false
  }
}

export function parseCreateChildTokenPayload(
  payload: unknown
): ChildAccessTokenCreateCommand {
  if (typeof payload !== "object" || payload === null) {
    throw new ValidationError("Request body must be a JSON object")
  }

  const record = payload as Record<string, unknown>

  if (
    typeof record.metadata !== "undefined" &&
    record.metadata !== null &&
    typeof record.metadata !== "object"
  ) {
    throw new ValidationError("metadata must be an object if provided")
  }

  return {
    metadata: (record.metadata as Record<string, unknown>) ?? {}
  }
}
