import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseClient } from "../../../_lib/supabase"
import { assertParentOrAdmin, requireAuthContext } from "../../../_lib/authContext"
import { ForbiddenError, handleRouteError, mapSupabaseError } from "../../../_lib/errors"
import { ensureUuid } from "../../../_lib/validation"
import { readJsonBody } from "../../../_lib/request"
import { parseUpdateRedemptionPayload } from "../../../_validators/reward"
import { ensureProfileInFamily } from "../../../_services/profilesService"
import { updateRewardRedemption } from "../../../_services/rewardRedemptionService"

async function ensureRedemptionFamily(
  redemptionId: string,
  familyId: string
): Promise<string> {
  const supabase = createSupabaseClient()
  const { data, error } = await supabase
    .from("reward_redemptions")
    .select("child_profile_id, rewards:rewards!inner(family_id)")
    .eq("id", redemptionId)
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  if (!data) {
    throw new ForbiddenError("Redemption not found")
  }

  if (data.rewards.family_id !== familyId) {
    throw new ForbiddenError("Redemption does not belong to this family")
  }

  // Ensure child belongs to family by later verification
  return data.child_profile_id
}

type RouteParams = {
  params: {
    redemptionId: string
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteParams
): Promise<Response> {
  try {
    const authContext = requireAuthContext()
    assertParentOrAdmin(authContext)

    const redemptionId = ensureUuid(context.params.redemptionId, "redemptionId")
    const familyId = authContext.familyId
    if (!familyId) {
      throw new ForbiddenError("Profile not associated with family")
    }

    const childProfileId = await ensureRedemptionFamily(redemptionId, familyId)
    const supabase = createSupabaseClient()
    await ensureProfileInFamily(supabase, childProfileId, familyId)

    const payload = await readJsonBody(request)
    const command = parseUpdateRedemptionPayload(payload)

    const redemption = await updateRewardRedemption(
      supabase,
      redemptionId,
      command
    )

    return NextResponse.json(redemption, { status: 200 })
  } catch (error) {
    return handleRouteError(error)
  }
}
