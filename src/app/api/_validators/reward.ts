import type { Json } from "@/db/database.types"
import type {
  AwardAchievementCommand,
  CreateAchievementCommand,
  CreateRewardCommand,
  CreateRewardRedemptionCommand,
  UpdateAchievementCommand,
  UpdateRewardCommand,
  UpdateRewardRedemptionCommand,
  UpsertRewardVisibilityCommand
} from "@/types"
import { ValidationError } from "../_lib/errors"
import { parseBoolean, parseNumber } from "../_lib/validation"
import { parseIsoDate } from "../_lib/dates"

const rewardSortFields = new Set(["cost", "name", "createdAt"])
const rewardRedemptionStatuses = new Set([
  "pending",
  "approved",
  "fulfilled",
  "rejected",
  "cancelled"
])

export type RewardListQuery = {
  includeDeleted: boolean
  childProfileId?: string
  page: number
  pageSize: number
  sort: "cost_points" | "name" | "created_at"
  order: "asc" | "desc"
}

export function parseRewardListQuery(
  searchParams: URLSearchParams
): RewardListQuery {
  const includeDeleted = parseBoolean(
    searchParams.get("includeDeleted"),
    false
  )

  const childProfileId = searchParams.get("childProfileId") ?? undefined

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
  if (!rewardSortFields.has(sortParam)) {
    throw new ValidationError("Invalid sort parameter")
  }

  const sortMap: Record<string, "cost_points" | "name" | "created_at"> = {
    cost: "cost_points",
    name: "name",
    createdAt: "created_at"
  }

  const orderParam = searchParams.get("order") ?? "desc"
  if (orderParam !== "asc" && orderParam !== "desc") {
    throw new ValidationError("Invalid order parameter")
  }

  return {
    includeDeleted,
    childProfileId,
    page,
    pageSize,
    sort: sortMap[sortParam],
    order: orderParam
  }
}

export function parseCreateRewardPayload(
  payload: unknown
): CreateRewardCommand {
  if (typeof payload !== "object" || payload === null) {
    throw new ValidationError("Request body must be a JSON object")
  }

  const record = payload as Record<string, unknown>
  const name = record.name
  if (typeof name !== "string" || name.trim().length === 0) {
    throw new ValidationError("name is required")
  }

  const cost = Number(record.cost)
  if (!Number.isInteger(cost) || cost <= 0) {
    throw new ValidationError("cost must be a positive integer")
  }

  const description =
    typeof record.description === "string" ? record.description : undefined
  const settings =
    record.settings && typeof record.settings === "object"
      ? (record.settings as Json)
      : undefined

  return {
    name,
    cost,
    description,
    settings
  }
}

export function parseUpdateRewardPayload(
  payload: unknown
): UpdateRewardCommand {
  if (typeof payload !== "object" || payload === null) {
    throw new ValidationError("Request body must be a JSON object")
  }

  const record = payload as Record<string, unknown>
  const command: UpdateRewardCommand = {}

  if (Object.prototype.hasOwnProperty.call(record, "name")) {
    const name = record.name
    if (typeof name !== "string" || name.trim().length === 0) {
      throw new ValidationError("name must be a non-empty string")
    }
    command.name = name
  }

  if (Object.prototype.hasOwnProperty.call(record, "cost")) {
    const cost = Number(record.cost)
    if (!Number.isInteger(cost) || cost <= 0) {
      throw new ValidationError("cost must be a positive integer")
    }
    command.cost = cost
  }

  if (Object.prototype.hasOwnProperty.call(record, "description")) {
    const description = record.description
    if (description !== null && typeof description !== "string") {
      throw new ValidationError("description must be string or null")
    }
    command.description = description ?? null
  }

  if (Object.prototype.hasOwnProperty.call(record, "isActive")) {
    command.isActive = Boolean(record.isActive)
  }

  if (Object.prototype.hasOwnProperty.call(record, "settings")) {
    if (record.settings && typeof record.settings !== "object") {
      throw new ValidationError("settings must be an object")
    }
    command.settings = record.settings as Json
  }

  if (Object.prototype.hasOwnProperty.call(record, "deletedAt")) {
    const deletedAt = record.deletedAt
    if (deletedAt === null) {
      command.deletedAt = null
    } else if (typeof deletedAt === "string") {
      if (Number.isNaN(Date.parse(deletedAt))) {
        throw new ValidationError("deletedAt must be valid ISO string")
      }
      command.deletedAt = deletedAt
    } else {
      throw new ValidationError("deletedAt must be string or null")
    }
  }

  if (Object.keys(command).length === 0) {
    throw new ValidationError("No fields provided to update")
  }

  return command
}

export function parseVisibilityPayload(
  payload: unknown
): UpsertRewardVisibilityCommand {
  if (typeof payload !== "object" || payload === null) {
    throw new ValidationError("Request body must be a JSON object")
  }

  const record = payload as Record<string, unknown>

  const visibleFrom = parseIsoDate(record.visibleFrom as string, "visibleFrom")
  const visibleUntil = parseIsoDate(record.visibleUntil as string, "visibleUntil")

  if (visibleFrom && visibleUntil && visibleFrom > visibleUntil) {
    throw new ValidationError("visibleUntil must be after visibleFrom")
  }

  return {
    visibleFrom: visibleFrom ?? null,
    visibleUntil: visibleUntil ?? null,
    metadata:
      record.metadata && typeof record.metadata === "object"
        ? (record.metadata as Json)
        : undefined
  }
}

export function parseRedeemPayload(
  payload: unknown
): CreateRewardRedemptionCommand {
  if (typeof payload !== "object" || payload === null) {
    throw new ValidationError("Request body must be a JSON object")
  }

  const record = payload as Record<string, unknown>
  const childProfileId = record.childProfileId
  if (typeof childProfileId !== "string") {
    throw new ValidationError("childProfileId is required")
  }

  const notes =
    typeof record.notes === "string" ? record.notes : undefined
  const metadata =
    record.metadata && typeof record.metadata === "object"
      ? (record.metadata as Json)
      : undefined

  return {
    childProfileId,
    notes,
    metadata
  }
}

export type RewardRedemptionListQuery = {
  status?: string
  page: number
  pageSize: number
  sort: "requested_at" | "status"
  order: "asc" | "desc"
}

export function parseRewardRedemptionListQuery(
  searchParams: URLSearchParams
): RewardRedemptionListQuery {
  const status = searchParams.get("status") ?? undefined
  if (status && !rewardRedemptionStatuses.has(status)) {
    throw new ValidationError("Invalid status filter")
  }

  const page = parseNumber(searchParams.get("page"), {
    fallback: 1,
    min: 1
  })

  const pageSize = parseNumber(searchParams.get("pageSize"), {
    fallback: 25,
    min: 1,
    max: 100
  })

  const sortParam = searchParams.get("sort") ?? "requestedAt"
  const sortMap: Record<string, "requested_at" | "status"> = {
    requestedAt: "requested_at",
    status: "status"
  }

  if (!Object.prototype.hasOwnProperty.call(sortMap, sortParam)) {
    throw new ValidationError("Invalid sort parameter")
  }

  const orderParam = searchParams.get("order") ?? "desc"
  if (orderParam !== "asc" && orderParam !== "desc") {
    throw new ValidationError("Invalid order parameter")
  }

  return {
    status,
    page,
    pageSize,
    sort: sortMap[sortParam],
    order: orderParam
  }
}

export function parseUpdateRedemptionPayload(
  payload: unknown
): UpdateRewardRedemptionCommand {
  if (typeof payload !== "object" || payload === null) {
    throw new ValidationError("Request body must be a JSON object")
  }

  const record = payload as Record<string, unknown>
  const status = record.status
  if (typeof status !== "string" || !rewardRedemptionStatuses.has(status)) {
    throw new ValidationError("Invalid status value")
  }

  const command: UpdateRewardRedemptionCommand = {
    status: status as UpdateRewardRedemptionCommand["status"]
  }

  if (Object.prototype.hasOwnProperty.call(record, "notes")) {
    if (record.notes !== null && typeof record.notes !== "string") {
      throw new ValidationError("notes must be string or null")
    }
    command.notes = record.notes ?? null
  }

  if (Object.prototype.hasOwnProperty.call(record, "confirmedByProfileId")) {
    const confirmed = record.confirmedByProfileId
    if (confirmed !== null && typeof confirmed !== "string") {
      throw new ValidationError("confirmedByProfileId must be string or null")
    }
    command.confirmedByProfileId = confirmed ?? null
  }

  return command
}

export function parseCreateAchievementPayload(
  payload: unknown
): CreateAchievementCommand {
  if (typeof payload !== "object" || payload === null) {
    throw new ValidationError("Request body must be a JSON object")
  }

  const record = payload as Record<string, unknown>

  const code = record.code
  if (typeof code !== "string" || code.trim().length === 0) {
    throw new ValidationError("code is required")
  }

  const name = record.name
  if (typeof name !== "string" || name.trim().length === 0) {
    throw new ValidationError("name is required")
  }

  if (!record.criteria || typeof record.criteria !== "object") {
    throw new ValidationError("criteria must be provided")
  }

  const description =
    typeof record.description === "string" ? record.description : undefined
  const iconUrl =
    typeof record.iconUrl === "string" ? record.iconUrl : undefined

  return {
    code,
    name,
    description,
    criteria: record.criteria as Json,
    iconUrl
  }
}

export function parseUpdateAchievementPayload(
  payload: unknown
): UpdateAchievementCommand {
  if (typeof payload !== "object" || payload === null) {
    throw new ValidationError("Request body must be a JSON object")
  }

  const record = payload as Record<string, unknown>
  const command: UpdateAchievementCommand = {}

  if (Object.prototype.hasOwnProperty.call(record, "name")) {
    const name = record.name
    if (typeof name !== "string" || name.trim().length === 0) {
      throw new ValidationError("name must be a non-empty string")
    }
    command.name = name
  }

  if (Object.prototype.hasOwnProperty.call(record, "description")) {
    const description = record.description
    if (description !== null && typeof description !== "string") {
      throw new ValidationError("description must be string or null")
    }
    command.description = description ?? null
  }

  if (Object.prototype.hasOwnProperty.call(record, "criteria")) {
    if (!record.criteria || typeof record.criteria !== "object") {
      throw new ValidationError("criteria must be an object")
    }
    command.criteria = record.criteria as Json
  }

  if (Object.prototype.hasOwnProperty.call(record, "iconUrl")) {
    const iconUrl = record.iconUrl
    if (iconUrl !== null && typeof iconUrl !== "string") {
      throw new ValidationError("iconUrl must be string or null")
    }
    command.iconUrl = iconUrl ?? null
  }

  if (Object.prototype.hasOwnProperty.call(record, "isActive")) {
    command.isActive = Boolean(record.isActive)
  }

  if (Object.prototype.hasOwnProperty.call(record, "deletedAt")) {
    const deletedAt = record.deletedAt
    if (deletedAt === null) {
      command.deletedAt = null
    } else if (typeof deletedAt === "string") {
      if (Number.isNaN(Date.parse(deletedAt))) {
        throw new ValidationError("deletedAt must be valid ISO string")
      }
      command.deletedAt = deletedAt
    } else {
      throw new ValidationError("deletedAt must be string or null")
    }
  }

  if (Object.keys(command).length === 0) {
    throw new ValidationError("No fields provided to update")
  }

  return command
}

export function parseAwardAchievementPayload(
  payload: unknown
): AwardAchievementCommand {
  if (typeof payload !== "object" || payload === null) {
    throw new ValidationError("Request body must be a JSON object")
  }

  const record = payload as Record<string, unknown>
  const achievementId = record.achievementId
  if (typeof achievementId !== "string") {
    throw new ValidationError("achievementId is required")
  }

  const metadata =
    record.metadata && typeof record.metadata === "object"
      ? (record.metadata as Json)
      : undefined

  return {
    achievementId,
    metadata
  }
}

export type AchievementsListQuery = {
  isActive: boolean | undefined
  page: number
  pageSize: number
  sort: "name" | "created_at"
  order: "asc" | "desc"
}

export function parseAchievementsListQuery(
  searchParams: URLSearchParams
): AchievementsListQuery {
  const isActiveParam = searchParams.get("isActive")
  const isActive =
    typeof isActiveParam === "string"
      ? parseBoolean(isActiveParam, true)
      : undefined

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
  const sortMap: Record<string, "name" | "created_at"> = {
    name: "name",
    createdAt: "created_at"
  }

  if (!Object.prototype.hasOwnProperty.call(sortMap, sortParam)) {
    throw new ValidationError("Invalid sort parameter")
  }

  const orderParam = searchParams.get("order") ?? "desc"
  if (orderParam !== "asc" && orderParam !== "desc") {
    throw new ValidationError("Invalid order parameter")
  }

  return {
    isActive,
    page,
    pageSize,
    sort: sortMap[sortParam],
    order: orderParam
  }
}
