import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseClient } from "../../../_lib/supabase"
import {
  assertParentOrAdmin,
  requireAuthContext
} from "../../../_lib/authContext"
import { handleRouteError, ForbiddenError, mapSupabaseError } from "../../../_lib/errors"
import { ensureUuid } from "../../../_lib/validation"
import { readJsonBody } from "../../../_lib/request"
import { parseUpdateRewardPayload } from "../../../_validators/reward"
import {
  archiveReward,
  getRewardDetails,
  updateReward
} from "../../../_services/rewardsService"

async function ensureRewardBelongsToFamily(
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

export async function GET(
  _request: NextRequest,
  context: RouteParams
): Promise<Response> {
  try {
    const authContext = requireAuthContext()
    assertParentOrAdmin(authContext)

    const rewardId = ensureUuid(context.params.rewardId, "rewardId")
    const familyId = authContext.familyId
    if (!familyId) {
      throw new ForbiddenError("Profile not associated with family")
    }

    await ensureRewardBelongsToFamily(rewardId, familyId)
    const supabase = createSupabaseClient()
    const details = await getRewardDetails(supabase, rewardId)

    return NextResponse.json(details, { status: 200 })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteParams
): Promise<Response> {
  try {
    const authContext = requireAuthContext()
    assertParentOrAdmin(authContext)

    const rewardId = ensureUuid(context.params.rewardId, "rewardId")
    const familyId = authContext.familyId
    if (!familyId) {
      throw new ForbiddenError("Profile not associated with family")
    }

    await ensureRewardBelongsToFamily(rewardId, familyId)

    const payload = await readJsonBody(request)
    const command = parseUpdateRewardPayload(payload)

    const supabase = createSupabaseClient()
    const reward = await updateReward(supabase, rewardId, command)

    return NextResponse.json(reward, { status: 200 })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteParams
): Promise<Response> {
  try {
    const authContext = requireAuthContext()
    assertParentOrAdmin(authContext)

    const rewardId = ensureUuid(context.params.rewardId, "rewardId")
    const familyId = authContext.familyId
    if (!familyId) {
      throw new ForbiddenError("Profile not associated with family")
    }

    await ensureRewardBelongsToFamily(rewardId, familyId)
    const supabase = createSupabaseClient()
    const result = await archiveReward(supabase, rewardId)

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    return handleRouteError(error)
  }
}
