import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseClient } from "../../../../../_lib/supabase"
import { assertParentOrAdmin, requireAuthContext } from "../../../../../_lib/authContext"
import { ForbiddenError, handleRouteError, mapSupabaseError } from "../../../../../_lib/errors"
import { ensureUuid } from "../../../../../_lib/validation"
import { listRewardVisibility } from "../../../../../_services/rewardVisibilityService"

type RouteParams = {
  params: {
    rewardId: string
  }
}

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

    await ensureRewardFamily(rewardId, familyId)
    const supabase = createSupabaseClient()
    const visibility = await listRewardVisibility(supabase, rewardId)

    return NextResponse.json(visibility, { status: 200 })
  } catch (error) {
    return handleRouteError(error)
  }
}
