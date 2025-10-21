import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/db/database.types"
import type {
  CreateRewardRedemptionCommand,
  RewardRedemptionCreateResultDto,
  RewardRedemptionDto,
  RewardRedemptionListResponseDto,
  UpdateRewardRedemptionCommand
} from "@/types"
import {
  ConflictError,
  mapSupabaseError,
  NotFoundError,
  ValidationError
} from "../_lib/errors"

type Client = SupabaseClient<Database>

type RewardRow = Database["public"]["Tables"]["rewards"]["Row"]
type RedemptionRow = Database["public"]["Tables"]["reward_redemptions"]["Row"]

function mapRedemption(row: RedemptionRow): RewardRedemptionDto {
  return {
    id: row.id,
    rewardId: row.reward_id,
    childProfileId: row.child_profile_id,
    status: row.status,
    pointsCost: row.points_cost,
    requestedAt: row.requested_at,
    confirmedAt: row.confirmed_at,
    confirmedByProfileId: row.confirmed_by_profile_id,
    cancelledAt: row.cancelled_at,
    cancelledByProfileId: row.cancelled_by_profile_id,
    pointTransactionId: row.point_transaction_id,
    notes: row.notes,
    metadata: row.metadata,
    updatedAt: row.updated_at
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

  if (!data.is_active) {
    throw new ConflictError("Reward is not active")
  }

  return data
}

async function fetchChildBalance(
  client: Client,
  familyId: string,
  childProfileId: string
): Promise<number> {
  const { data, error } = await client
    .from("point_transactions")
    .select("points_delta")
    .eq("family_id", familyId)
    .eq("profile_id", childProfileId)

  if (error) {
    throw mapSupabaseError(error)
  }

  return data.reduce((total, row) => total + (row.points_delta ?? 0), 0)
}

async function insertPointTransaction(
  client: Client,
  familyId: string,
  childProfileId: string,
  cost: number,
  reason: string
): Promise<{ id: string; balanceAfter: number }> {
  const currentBalance = await fetchChildBalance(client, familyId, childProfileId)
  const newBalance = currentBalance - cost

  const { data, error } = await client
    .from("point_transactions")
    .insert({
      family_id: familyId,
      profile_id: childProfileId,
      transaction_type: "reward_redeem",
      points_delta: -cost,
      reason,
      balance_after: newBalance,
      metadata: {}
    })
    .select("id, balance_after")
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  if (!data) {
    throw new ValidationError("Failed to record point transaction")
  }

  return { id: data.id, balanceAfter: data.balance_after }
}

export async function createRewardRedemption(
  client: Client,
  rewardId: string,
  familyId: string,
  command: CreateRewardRedemptionCommand
): Promise<RewardRedemptionCreateResultDto> {
  const reward = await fetchReward(client, rewardId)

  const balance = await fetchChildBalance(client, familyId, command.childProfileId)
  if (balance < reward.cost_points) {
    throw new ConflictError("Insufficient points")
  }

  const pointTransaction = await insertPointTransaction(
    client,
    familyId,
    command.childProfileId,
    reward.cost_points,
    `Redeemed reward ${reward.name}`
  )

  const { data, error } = await client
    .from("reward_redemptions")
    .insert({
      reward_id: rewardId,
      child_profile_id: command.childProfileId,
      status: "pending",
      points_cost: reward.cost_points,
      requested_at: new Date().toISOString(),
      notes: command.notes ?? null,
      metadata: command.metadata ?? {},
      point_transaction_id: pointTransaction.id
    })
    .select("*")
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  if (!data) {
    throw new NotFoundError("Failed to create redemption")
  }

  return {
    ...mapRedemption(data as RedemptionRow),
    balanceAfter: pointTransaction.balanceAfter
  }
}

type RedemptionListOptions = {
  childProfileId: string
  status?: string
  limit: number
  offset: number
  sort: "requested_at" | "status"
  order: "asc" | "desc"
}

export async function listRewardRedemptions(
  client: Client,
  options: RedemptionListOptions
): Promise<RewardRedemptionListResponseDto> {
  const query = client
    .from("reward_redemptions")
    .select("*", { count: "exact" })
    .eq("child_profile_id", options.childProfileId)
    .order(options.sort, { ascending: options.order === "asc" })
    .range(options.offset, options.offset + options.limit - 1)

  if (options.status) {
    query.eq("status", options.status)
  }

  const { data, error, count } = await query

  if (error) {
    throw mapSupabaseError(error)
  }

  return {
    data: (data as RedemptionRow[]).map(mapRedemption),
    meta: {
      page: Math.floor(options.offset / options.limit) + 1,
      total: count ?? undefined
    }
  }
}

export async function updateRewardRedemption(
  client: Client,
  redemptionId: string,
  command: UpdateRewardRedemptionCommand
): Promise<RewardRedemptionDto> {
  const { data, error } = await client
    .from("reward_redemptions")
    .update({
      status: command.status,
      notes: command.notes ?? null,
      confirmed_by_profile_id: command.confirmedByProfileId ?? null,
      confirmed_at:
        command.status === "fulfilled" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    })
    .eq("id", redemptionId)
    .select("*")
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  if (!data) {
    throw new NotFoundError("Reward redemption not found")
  }

  return mapRedemption(data as RedemptionRow)
}
