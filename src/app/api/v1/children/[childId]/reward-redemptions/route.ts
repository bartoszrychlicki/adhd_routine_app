import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseClient } from "../../../../_lib/supabase"
import { requireAuthContext } from "../../../../_lib/authContext"
import { ForbiddenError, handleRouteError } from "../../../../_lib/errors"
import { ensureUuid } from "../../../../_lib/validation"
import { parseRewardRedemptionListQuery } from "../../../../_validators/reward"
import { ensureProfileInFamily } from "../../../../_services/profilesService"
import { listRewardRedemptions } from "../../../../_services/rewardRedemptionService"

type RouteParams = {
  params: {
    childId: string
  }
}

export async function GET(
  request: NextRequest,
  context: RouteParams
): Promise<Response> {
  try {
    const authContext = requireAuthContext()
    const childId = ensureUuid(context.params.childId, "childId")

    if (!authContext.familyId) {
      throw new ForbiddenError("Profile not associated with family")
    }

    if (authContext.role === "child" && authContext.profileId !== childId) {
      throw new ForbiddenError("Children can only view their own redemptions")
    }

    const query = parseRewardRedemptionListQuery(request.nextUrl.searchParams)
    const offset = (query.page - 1) * query.pageSize

    const supabase = createSupabaseClient()
    await ensureProfileInFamily(supabase, childId, authContext.familyId)

    const redemptions = await listRewardRedemptions(supabase, {
      childProfileId: childId,
      status: query.status,
      limit: query.pageSize,
      offset,
      sort: query.sort,
      order: query.order
    })

    return NextResponse.json(redemptions, { status: 200 })
  } catch (error) {
    return handleRouteError(error)
  }
}
