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
  parseAchievementsListQuery,
  parseCreateAchievementPayload
} from "../../../../../_validators/reward"
import {
  createAchievement,
  listAchievements
} from "../../../../../_services/achievementsService"

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

    const query = parseAchievementsListQuery(request.nextUrl.searchParams)
    const offset = (query.page - 1) * query.pageSize
    const supabase = createSupabaseClient()

    const achievements = await listAchievements(supabase, {
      familyId,
      isActive: query.isActive,
      limit: query.pageSize,
      offset,
      sort: query.sort,
      order: query.order
    })

    return NextResponse.json(achievements, { status: 200 })
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
    const command = parseCreateAchievementPayload(payload)

    const supabase = createSupabaseClient()
    const achievement = await createAchievement(supabase, familyId, command)

    return NextResponse.json(achievement, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
