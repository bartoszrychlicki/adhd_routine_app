import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/db/database.types"
import type {
  ChildWalletDto,
  ChildWalletRecentTransactionDto,
  RewardPendingRedemptionDto
} from "@/types"
import { mapSupabaseError } from "../_lib/errors"

type Client = SupabaseClient<Database>

export async function getChildWallet(
  client: Client,
  familyId: string,
  childProfileId: string,
  recentLimit = 5
): Promise<ChildWalletDto> {
  const { data: balanceData, error: balanceError } = await client
    .from("point_transactions")
    .select("points_delta")
    .eq("family_id", familyId)
    .eq("profile_id", childProfileId)

  if (balanceError) {
    throw mapSupabaseError(balanceError)
  }

  const balance = balanceData.reduce((acc, row) => acc + (row.points_delta ?? 0), 0)

  const { data: recent, error: recentError } = await client
    .from("point_transactions")
    .select("id, transaction_type, points_delta, created_at")
    .eq("family_id", familyId)
    .eq("profile_id", childProfileId)
    .order("created_at", { ascending: false })
    .limit(recentLimit)

  if (recentError) {
    throw mapSupabaseError(recentError)
  }

  const recentTransactions: ChildWalletRecentTransactionDto[] = recent.map(
    (row) => ({
      id: row.id,
      transactionType: row.transaction_type,
      pointsDelta: row.points_delta,
      createdAt: row.created_at
    })
  )

  const { data: pending, error: pendingError } = await client
    .from("reward_redemptions")
    .select("id, points_cost, status")
    .eq("child_profile_id", childProfileId)
    .in("status", ["pending", "approved"])

  if (pendingError) {
    throw mapSupabaseError(pendingError)
  }

  const pendingRedemptions: RewardPendingRedemptionDto[] = pending.map((row) => ({
    rewardRedemptionId: row.id,
    pointsCost: row.points_cost,
    status: row.status
  }))

  return {
    balance,
    pendingRedemptions,
    recentTransactions
  }
}
