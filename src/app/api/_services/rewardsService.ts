import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/db/database.types"
import type {
  CreateRewardCommand,
  RewardArchiveResultDto,
  RewardDetailsDto,
  RewardListResponseDto,
  RewardSummaryDto,
  RewardVisibilityDto,
  UpdateRewardCommand
} from "@/types"
import { mapSupabaseError, NotFoundError } from "../_lib/errors"

type Client = SupabaseClient<Database>
type RewardRow = Database["public"]["Tables"]["rewards"]["Row"]

function mapRewardSummary(row: RewardRow): RewardSummaryDto {
  return {
    id: row.id,
    name: row.name,
    cost: row.cost_points,
    isActive: row.is_active,
    availableForChildIds: [],
    deletedAt: row.deleted_at
  }
}

async function fetchRewardVisibility(
  client: Client,
  rewardIds: string[]
): Promise<Map<string, RewardVisibilityDto[]>> {
  if (!rewardIds.length) {
    return new Map()
  }

  const { data, error } = await client
    .from("reward_child_visibility")
    .select("reward_id, child_profile_id, is_visible, visible_from, visible_until, updated_at")
    .in("reward_id", rewardIds)
    .is("deleted_at", null)

  if (error) {
    throw mapSupabaseError(error)
  }

  const visibilityMap = new Map<string, RewardVisibilityDto[]>()
  data.forEach((row) => {
    const list = visibilityMap.get(row.reward_id) ?? []
    list.push({
      childProfileId: row.child_profile_id,
      isVisible: row.is_visible,
      visibleFrom: row.visible_from,
      visibleUntil: row.visible_until,
      updatedAt: row.updated_at
    })
    visibilityMap.set(row.reward_id, list)
  })

  return visibilityMap
}

type RewardListOptions = {
  familyId: string
  includeDeleted: boolean
  childProfileId?: string
  limit: number
  offset: number
  sort: "cost_points" | "name" | "created_at"
  order: "asc" | "desc"
}

export async function listRewards(
  client: Client,
  options: RewardListOptions
): Promise<RewardListResponseDto> {
  const query = client
    .from("rewards")
    .select("*", { count: "exact" })
    .eq("family_id", options.familyId)
    .order(options.sort, { ascending: options.order === "asc" })
    .range(options.offset, options.offset + options.limit - 1)

  if (!options.includeDeleted) {
    query.is("deleted_at", null)
  }

  const { data, error, count } = await query

  if (error) {
    throw mapSupabaseError(error)
  }

  const summaries = (data as RewardRow[]).map(mapRewardSummary)
  const rewardIds = summaries.map((reward) => reward.id)
  const visibilityMap = await fetchRewardVisibility(client, rewardIds)

  summaries.forEach((summary) => {
    const visibility = visibilityMap.get(summary.id) ?? []
    summary.availableForChildIds = visibility
      .filter((item) => item.isVisible !== false)
      .map((item) => item.childProfileId)
  })

  if (options.childProfileId) {
    summaries.forEach((summary) => {
      if (!summary.availableForChildIds.includes(options.childProfileId!)) {
        summary.availableForChildIds = []
      }
    })
  }

  return {
    data: summaries,
    meta: {
      page: Math.floor(options.offset / options.limit) + 1,
      total: count ?? undefined
    }
  }
}

export async function createReward(
  client: Client,
  familyId: string,
  command: CreateRewardCommand
): Promise<RewardSummaryDto> {
  const { data, error } = await client
    .from("rewards")
    .insert({
      family_id: familyId,
      name: command.name,
      cost_points: command.cost,
      description: command.description ?? null,
      settings: command.settings ?? {},
      is_active: true
    })
    .select("*")
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  if (!data) {
    throw new NotFoundError("Failed to create reward")
  }

  return {
    id: data.id,
    name: data.name,
    cost: data.cost_points,
    isActive: data.is_active,
    availableForChildIds: [],
    deletedAt: data.deleted_at
  }
}

async function fetchReward(
  client: Client,
  rewardId: string
): Promise<RewardRow> {
  const { data, error } = await client
    .from("rewards")
    .select("*")
    .eq("id", rewardId)
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  if (!data) {
    throw new NotFoundError("Reward not found")
  }

  return data
}

export async function getRewardDetails(
  client: Client,
  rewardId: string
): Promise<RewardDetailsDto> {
  const reward = await fetchReward(client, rewardId)
  const visibility = await fetchRewardVisibility(client, [rewardId])

  return {
    id: reward.id,
    name: reward.name,
    cost: reward.cost_points,
    description: reward.description,
    isActive: reward.is_active,
    isRepeatable: reward.is_repeatable,
    settings: reward.settings,
    deletedAt: reward.deleted_at,
    childVisibility: visibility.get(rewardId) ?? []
  }
}

function buildRewardUpdatePayload(
  command: UpdateRewardCommand
): Database["public"]["Tables"]["rewards"]["Update"] {
  const payload: Database["public"]["Tables"]["rewards"]["Update"] = {}

  if (typeof command.name !== "undefined") {
    payload.name = command.name
  }

  if (typeof command.cost !== "undefined") {
    payload.cost_points = command.cost
  }

  if (typeof command.description !== "undefined") {
    payload.description = command.description
  }

  if (typeof command.isActive !== "undefined") {
    payload.is_active = command.isActive
  }

  if (typeof command.isRepeatable !== "undefined") {
    payload.is_repeatable = command.isRepeatable
  }

  if (typeof command.settings !== "undefined") {
    payload.settings = command.settings
  }

  if (typeof command.deletedAt !== "undefined") {
    payload.deleted_at = command.deletedAt
  }

  if (Object.keys(payload).length > 0) {
    payload.updated_at = new Date().toISOString()
  }

  return payload
}

export async function updateReward(
  client: Client,
  rewardId: string,
  command: UpdateRewardCommand
): Promise<RewardDetailsDto> {
  const payload = buildRewardUpdatePayload(command)

  const { data, error } = await client
    .from("rewards")
    .update(payload)
    .eq("id", rewardId)
    .select("*")
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  if (!data) {
    throw new NotFoundError("Reward not found")
  }

  return getRewardDetails(client, rewardId)
}

export async function archiveReward(
  client: Client,
  rewardId: string
): Promise<RewardArchiveResultDto> {
  const { error } = await client
    .from("rewards")
    .update({
      deleted_at: new Date().toISOString(),
      is_active: false
    })
    .eq("id", rewardId)

  if (error) {
    throw mapSupabaseError(error)
  }

  return { message: "Reward archived" }
}
