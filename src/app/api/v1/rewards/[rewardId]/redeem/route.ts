import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseClient } from "../../../../../_lib/supabase"
import { requireAuthContext } from "../../../../../_lib/authContext"
import { ForbiddenError, handleRouteError, mapSupabaseError } from "../../../../../_lib/errors"
import { ensureUuid } from "../../../../../_lib/validation"
import { readJsonBody } from "../../../../../_lib/request"
import { parseRedeemPayload } from "../../../../../_validators/reward"
import { createRewardRedemption } from "../../../../../_services/rewardRedemptionService"
import { ensureProfileInFamily } from "../../../../../_services/profilesService"

async function ensureRewardFamily(
  rewardId: string,
  familyId: string
): Promise<void> {
  const supabase = createSupabaseClient()
  const { data, error } = await supabase
    .from("rewards")
    .select("family_id")
    .eq("id", rewardId)
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  if (!data || data.family_id !== familyId) {
    throw new ForbiddenError("Reward does not belong to this family")
  }
}

type RouteParams = {
  params: {
    rewardId: string
  }
}

export async function POST(
  request: NextRequest,
  context: RouteParams
): Promise<Response> {
  try {
    const authContext = requireAuthContext()
    const familyId = authContext.familyId
    if (!familyId) {
      throw new ForbiddenError("Profile not associated with family")
    }

    const rewardId = ensureUuid(context.params.rewardId, "rewardId")
    const payload = await readJsonBody(request)
    const command = parseRedeemPayload(payload)

    if (
      authContext.role === "child" &&
      authContext.profileId !== command.childProfileId
    ) {
      throw new ForbiddenError("Children can only redeem for themselves")
    }

    const supabase = createSupabaseClient()
    await ensureRewardFamily(rewardId, familyId)
    await ensureProfileInFamily(supabase, command.childProfileId, familyId)

    const redemption = await createRewardRedemption(
      supabase,
      rewardId,
      familyId,
      command
    )

    return NextResponse.json(redemption, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
