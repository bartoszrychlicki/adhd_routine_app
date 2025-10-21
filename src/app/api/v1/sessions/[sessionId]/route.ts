import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseClient } from "../../../_lib/supabase"
import { requireAuthContext } from "../../../_lib/authContext"
import {
  ForbiddenError,
  handleRouteError
} from "../../../_lib/errors"
import { ensureUuid, parseBoolean } from "../../../_lib/validation"
import { ensureProfileInFamily } from "../../../_services/profilesService"
import { getSessionDetails } from "../../../_services/routineSessionsService"

type RouteParams = {
  params: {
    sessionId: string
  }
}

export async function GET(
  request: NextRequest,
  context: RouteParams
): Promise<Response> {
  try {
    const authContext = requireAuthContext()

    if (!authContext.familyId) {
      throw new ForbiddenError("Profile not associated with family")
    }

    const sessionId = ensureUuid(context.params.sessionId, "sessionId")
    const includeTasks = parseBoolean(
      request.nextUrl.searchParams.get("includeTasks"),
      true
    )
    const includePerformance = parseBoolean(
      request.nextUrl.searchParams.get("includePerformance"),
      true
    )

    const supabase = createSupabaseClient()
    const details = await getSessionDetails(supabase, sessionId, {
      includeTasks,
      includePerformance
    })

    await ensureProfileInFamily(
      supabase,
      details.childProfileId,
      authContext.familyId
    )

    if (
      authContext.role === "child" &&
      authContext.profileId !== details.childProfileId
    ) {
      throw new ForbiddenError("Children can only view their own sessions")
    }

    return NextResponse.json(details, { status: 200 })
  } catch (error) {
    return handleRouteError(error)
  }
}
