import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/db/database.types"
import type {
  RewardVisibilityDeleteResultDto,
  RewardVisibilityDto,
  RewardVisibilityListDto,
  UpsertRewardVisibilityCommand
} from "@/types"
import { mapSupabaseError, NotFoundError } from "../_lib/errors"

type Client = SupabaseClient<Database>

export async function listRewardVisibility(
  client: Client,
  rewardId: string
): Promise<RewardVisibilityListDto> {
  const { data, error } = await client
    .from("reward_child_visibility")
    .select("child_profile_id, is_visible, visible_from, visible_until, updated_at")
    .eq("reward_id", rewardId)
    .is("deleted_at", null)

  if (error) {
    throw mapSupabaseError(error)
  }

  return {
    data: data.map((row) => ({
      childProfileId: row.child_profile_id,
      isVisible: row.is_visible,
      visibleFrom: row.visible_from,
      visibleUntil: row.visible_until,
      updatedAt: row.updated_at
    }))
  }
}

export async function upsertRewardVisibility(
  client: Client,
  rewardId: string,
  childProfileId: string,
  command: UpsertRewardVisibilityCommand
): Promise<RewardVisibilityDto> {
  const { data, error } = await client
    .from("reward_child_visibility")
    .upsert(
      {
        reward_id: rewardId,
        child_profile_id: childProfileId,
        is_visible: true,
        visible_from: command.visibleFrom ?? null,
        visible_until: command.visibleUntil ?? null,
        metadata: command.metadata ?? {},
        updated_at: new Date().toISOString()
      },
      { onConflict: "reward_id,child_profile_id" }
    )
    .select(
      "child_profile_id, is_visible, visible_from, visible_until, updated_at"
    )
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  if (!data) {
    throw new NotFoundError("Failed to upsert visibility")
  }

  return {
    childProfileId: data.child_profile_id,
    isVisible: data.is_visible,
    visibleFrom: data.visible_from,
    visibleUntil: data.visible_until,
    updatedAt: data.updated_at
  }
}

export async function deleteRewardVisibility(
  client: Client,
  rewardId: string,
  childProfileId: string
): Promise<RewardVisibilityDeleteResultDto> {
  const { data, error } = await client
    .from("reward_child_visibility")
    .update({ deleted_at: new Date().toISOString() })
    .eq("reward_id", rewardId)
    .eq("child_profile_id", childProfileId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  if (!data) {
    throw new NotFoundError("Visibility not found")
  }

  return { message: "Visibility removed" }
}
