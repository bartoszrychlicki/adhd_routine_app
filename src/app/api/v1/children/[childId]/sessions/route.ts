import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseClient } from "../../../../_lib/supabase"
import { requireAuthContext } from "../../../../_lib/authContext"
import {
  ForbiddenError,
  handleRouteError
} from "../../../../_lib/errors"
import { ensureUuid } from "../../../../_lib/validation"
import { parseSessionListQuery, parseSessionCreatePayload } from "../../../../_validators/session"
import { ensureProfileInFamily } from "../../../../_services/profilesService"
import {
  listChildSessions,
  startRoutineSession
} from "../../../../_services/routineSessionsService"
import { readJsonBody } from "../../../../_lib/request"

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
      throw new ForbiddenError("Children can only view their own sessions")
    }

    const supabase = createSupabaseClient()
    await ensureProfileInFamily(supabase, childId, authContext.familyId)

    const query = parseSessionListQuery(request.nextUrl.searchParams)
    const offset = (query.page - 1) * query.pageSize

    const sessions = await listChildSessions(supabase, {
      childProfileId: childId,
      status: query.status,
      fromDate: query.fromDate,
      toDate: query.toDate,
      routineId: query.routineId,
      limit: query.pageSize,
      offset,
      sort: query.sort,
      order: query.order
    })

    return NextResponse.json(sessions, { status: 200 })
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

    const childId = ensureUuid(context.params.childId, "childId")

    if (!authContext.familyId) {
      throw new ForbiddenError("Profile not associated with family")
    }

    if (
      authContext.role === "child" &&
      authContext.profileId !== childId
    ) {
      throw new ForbiddenError("Children can only start their own sessions")
    }

    const supabase = createSupabaseClient()
    await ensureProfileInFamily(supabase, childId, authContext.familyId)

    const payload = await readJsonBody(request)
    const command = parseSessionCreatePayload(payload)

    const session = await startRoutineSession(supabase, childId, command)
    return NextResponse.json(session, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
