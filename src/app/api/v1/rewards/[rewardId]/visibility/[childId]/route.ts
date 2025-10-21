import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseClient } from "../../../../../../_lib/supabase"
import { assertParentOrAdmin, requireAuthContext } from "../../../../../../_lib/authContext"
import { ForbiddenError, handleRouteError, mapSupabaseError } from "../../../../../../_lib/errors"
import { ensureUuid } from "../../../../../../_lib/validation"
import { readJsonBody } from "../../../../../../_lib/request"
import { parseVisibilityPayload } from "../../../../../../_validators/reward"
import {
  deleteRewardVisibility,
  upsertRewardVisibility
} from "../../../../../../_services/rewardVisibilityService"
import { ensureProfileInFamily } from "../../../../../../_services/profilesService"

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
    childId: string
  }
}

export async function PUT(
  request: NextRequest,
  context: RouteParams
): Promise<Response> {
  try {
    const authContext = requireAuthContext()
    assertParentOrAdmin(authContext)

    const rewardId = ensureUuid(context.params.rewardId, "rewardId")
    const childId = ensureUuid(context.params.childId, "childId")
    const familyId = authContext.familyId
    if (!familyId) {
      throw new ForbiddenError("Profile not associated with family")
    }

    await ensureRewardFamily(rewardId, familyId)
    const supabase = createSupabaseClient()
    await ensureProfileInFamily(supabase, childId, familyId)

    const payload = await readJsonBody(request)
    const command = parseVisibilityPayload(payload)

    const visibility = await upsertRewardVisibility(
      supabase,
      rewardId,
      childId,
      command
    )

    return NextResponse.json(visibility, { status: 200 })
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
    const childId = ensureUuid(context.params.childId, "childId")
    const familyId = authContext.familyId
    if (!familyId) {
      throw new ForbiddenError("Profile not associated with family")
    }

    await ensureRewardFamily(rewardId, familyId)
    const supabase = createSupabaseClient()
    await ensureProfileInFamily(supabase, childId, familyId)

    const result = await deleteRewardVisibility(supabase, rewardId, childId)
    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    return handleRouteError(error)
  }
}
