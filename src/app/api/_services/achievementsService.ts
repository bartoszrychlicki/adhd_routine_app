import type { Database } from "@/db/database.types"
import type {
  AchievementDto,
  AchievementListResponseDto,
  AwardAchievementCommand,
  CreateAchievementCommand,
  UpdateAchievementCommand,
  UserAchievementDto,
  UserAchievementListResponseDto
} from "@/types"
import {
  ConflictError,
  mapSupabaseError,
  NotFoundError,
  ValidationError
} from "../_lib/errors"
import type { AppSupabaseClient } from "../_lib/types"

type Client = AppSupabaseClient
type AchievementRow = Database["public"]["Tables"]["achievements"]["Row"]

function mapAchievement(row: AchievementRow): AchievementDto {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    criteria: row.criteria,
    iconUrl: row.icon_url,
    isActive: row.is_active,
    deletedAt: row.deleted_at,
    createdAt: row.created_at
  }
}

type AchievementListOptions = {
  familyId: string
  isActive?: boolean
  limit: number
  offset: number
  sort: "name" | "created_at"
  order: "asc" | "desc"
}

export async function listAchievements(
  client: Client,
  options: AchievementListOptions
): Promise<AchievementListResponseDto> {
  const query = client
    .from("achievements")
    .select("*", { count: "exact" })
    .or(`family_id.eq.${options.familyId},family_id.is.null`)
    .order(options.sort, { ascending: options.order === "asc" })
    .range(options.offset, options.offset + options.limit - 1)

  if (typeof options.isActive === "boolean") {
    query.eq("is_active", options.isActive)
  }

  const { data, error, count } = await query

  if (error) {
    throw mapSupabaseError(error)
  }

  return {
    data: (data as AchievementRow[]).map(mapAchievement),
    meta: {
      page: Math.floor(options.offset / options.limit) + 1,
      total: count ?? undefined
    }
  }
}

export async function createAchievement(
  client: Client,
  familyId: string,
  command: CreateAchievementCommand
): Promise<AchievementDto> {
  const { data, error } = await client
    .from("achievements")
    .insert({
      family_id: familyId,
      code: command.code,
      name: command.name,
      description: command.description ?? null,
      criteria: command.criteria,
      icon_url: command.iconUrl ?? null,
      is_active: true
    })
    .select("*")
    .maybeSingle()

  if (error) {
    if (error.code === "23505") {
      throw new ConflictError("Achievement code already exists")
    }
    throw mapSupabaseError(error)
  }

  if (!data) {
    throw new ValidationError("Failed to create achievement")
  }

  return mapAchievement(data as AchievementRow)
}

export async function updateAchievement(
  client: Client,
  achievementId: string,
  command: UpdateAchievementCommand
): Promise<AchievementDto> {
  const { data, error } = await client
    .from("achievements")
    .update({
      name: command.name,
      description: command.description,
      criteria: command.criteria,
      icon_url: command.iconUrl,
      is_active: command.isActive,
      deleted_at: command.deletedAt,
      updated_at: new Date().toISOString()
    })
    .eq("id", achievementId)
    .select("*")
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  if (!data) {
    throw new NotFoundError("Achievement not found")
  }

  return mapAchievement(data as AchievementRow)
}

export async function listChildAchievements(
  client: Client,
  childProfileId: string
): Promise<UserAchievementListResponseDto> {
  type AchievementRowWithJoin = {
    achievement_id: string
    awarded_at: string
    metadata: Record<string, unknown> | null
    achievements: {
      id: string
      code: string
      name: string
      description: string | null
      icon_url: string | null
    }
  }

  const { data, error } = await client
    .from("user_achievements")
    .select(
      `achievement_id, awarded_at, metadata, achievements:achievements!inner(id, code, name, description, icon_url)`
    )
    .eq("profile_id", childProfileId)

  if (error) {
    throw mapSupabaseError(error)
  }

  const rows: AchievementRowWithJoin[] = (data ?? []) as AchievementRowWithJoin[]

  const achievements: UserAchievementDto[] = rows.map((row) => ({
    achievementId: row.achievement_id,
    code: row.achievements.code,
    name: row.achievements.name,
    description: row.achievements.description,
    iconUrl: row.achievements.icon_url,
    awardedAt: row.awarded_at,
    metadata: row.metadata
  }))

  return { data: achievements }
}

export async function awardAchievement(
  client: Client,
  childProfileId: string,
  command: AwardAchievementCommand
): Promise<UserAchievementDto> {
  type AwardedAchievementRow = {
    achievement_id: string
    awarded_at: string
    metadata: Record<string, unknown> | null
    achievements: {
      code: string
      name: string
      description: string | null
      icon_url: string | null
    }
  }

  const { data, error } = await client
    .from("user_achievements")
    .insert({
      profile_id: childProfileId,
      achievement_id: command.achievementId,
      metadata: command.metadata ?? {},
      awarded_at: new Date().toISOString()
    })
    .select(
      `achievement_id, awarded_at, metadata, achievements:achievements!inner(code, name, description, icon_url)`
    )
    .maybeSingle()

  if (error) {
    if (error.code === "23505") {
      throw new ConflictError("Achievement already awarded")
    }
    throw mapSupabaseError(error)
  }

  if (!data) {
    throw new ValidationError("Failed to award achievement")
  }

  const row = data as AwardedAchievementRow

  return {
    achievementId: row.achievement_id,
    code: row.achievements.code,
    name: row.achievements.name,
    description: row.achievements.description,
    iconUrl: row.achievements.icon_url,
    awardedAt: row.awarded_at,
    metadata: row.metadata
  }
}
