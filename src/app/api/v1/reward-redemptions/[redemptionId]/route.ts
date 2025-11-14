import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseServerClient, type Database } from "@/lib/supabase"
import { assertParentOrAdmin, requireAuthContext } from "../../../_lib/authContext"
import { ForbiddenError, handleRouteError, mapSupabaseError } from "../../../_lib/errors"
import { ensureUuid } from "../../../_lib/validation"
import { readJsonBody } from "../../../_lib/request"
import { parseUpdateRedemptionPayload } from "../../../_validators/reward"
import { ensureProfileInFamily } from "../../../_services/profilesService"
import { updateRewardRedemption } from "../../../_services/rewardRedemptionService"

async function ensureRedemptionFamily(
  redemptionIdValidated: string,
  familyId: string
): Promise<string> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("reward_redemptions")
    .select("child_profile_id, rewards:rewards!inner(family_id)")
    .eq("id", redemptionIdValidated)
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  type RedemptionRow = Database["public"]["Tables"]["reward_redemptions"]["Row"] & {
    rewards: { family_id: string }
  }

  const row = (data as RedemptionRow | null) ?? null

  if (!row) {
    throw new ForbiddenError("Redemption not found")
  }

  if (row.rewards.family_id !== familyId) {
    throw new ForbiddenError("Redemption does not belong to this family")
  }

  // Ensure child belongs to family by later verification
  return row.child_profile_id
}

type RouteParams = {
  params: Promise<{
    redemptionId: string
  }>
}

export async function PATCH(
  request: NextRequest,
  context: RouteParams
): Promise<Response> {
  try {
    const supabase = await createSupabaseServerClient()

    const authContext = await requireAuthContext(supabase)
    assertParentOrAdmin(authContext)

    const { redemptionId } = await context.params
    const redemptionIdValidated = ensureUuid(redemptionId, "redemptionId")
    const familyId = authContext.familyId
    if (!familyId) {
      throw new ForbiddenError("Profile not associated with family")
    }

    const childProfileId = await ensureRedemptionFamily(redemptionIdValidated, familyId)
    await ensureProfileInFamily(supabase, childProfileId, familyId)

    const payload = await readJsonBody(request)
    const command = parseUpdateRedemptionPayload(payload)

    const redemption = await updateRewardRedemption(
      supabase,
      redemptionIdValidated,
      command
    )

    return NextResponse.json(redemption, { status: 200 })
  } catch (error) {
    return handleRouteError(error)
  }
}
