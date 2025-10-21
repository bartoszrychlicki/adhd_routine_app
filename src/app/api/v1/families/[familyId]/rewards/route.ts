import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseClient } from "../../../../../_lib/supabase"
import {
  assertFamilyAccess,
  assertParentOrAdmin,
  requireAuthContext
} from "../../../../../_lib/authContext"
import { handleRouteError } from "../../../../../_lib/errors"
import { ensureUuid } from "../../../../../_lib/validation"
import { readJsonBody } from "../../../../../_lib/request"
import {
  parseCreateRewardPayload,
  parseRewardListQuery
} from "../../../../../_validators/reward"
import {
  createReward,
  listRewards
} from "../../../../../_services/rewardsService"
import { ensureProfileInFamily } from "../../../../../_services/profilesService"

type RouteParams = {
  params: {
    familyId: string
  }
}

export async function GET(
  request: NextRequest,
  context: RouteParams
): Promise<Response> {
  try {
    const authContext = requireAuthContext()
    assertParentOrAdmin(authContext)

    const familyId = ensureUuid(context.params.familyId, "familyId")
    assertFamilyAccess(authContext, familyId)

    const query = parseRewardListQuery(request.nextUrl.searchParams)
    const offset = (query.page - 1) * query.pageSize

    const supabase = createSupabaseClient()
    if (query.childProfileId) {
      await ensureProfileInFamily(supabase, query.childProfileId, familyId)
    }

    const rewards = await listRewards(supabase, {
      familyId,
      includeDeleted: query.includeDeleted,
      childProfileId: query.childProfileId,
      limit: query.pageSize,
      offset,
      sort: query.sort,
      order: query.order
    })

    return NextResponse.json(rewards, { status: 200 })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(
  request: NextRequest,
  context: RouteParams
): Promise<Response> {
  try {
    const authContext = requireAuthContext()
    assertParentOrAdmin(authContext)

    const familyId = ensureUuid(context.params.familyId, "familyId")
    assertFamilyAccess(authContext, familyId)

    const payload = await readJsonBody(request)
    const command = parseCreateRewardPayload(payload)

    const supabase = createSupabaseClient()
    const reward = await createReward(supabase, familyId, command)

    return NextResponse.json(reward, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
