import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseClient } from "../../../../../_lib/supabase"
import { requireAuthContext } from "../../../../../_lib/authContext"
import {
  ForbiddenError,
  handleRouteError
} from "../../../../../_lib/errors"
import { ensureUuid } from "../../../../../_lib/validation"
import { readJsonBody } from "../../../../../_lib/request"
import { parseSessionCompletionPayload } from "../../../../../_validators/session"
import { ensureProfileInFamily } from "../../../../../_services/profilesService"
import {
  completeRoutineSession,
  getSessionDetails
} from "../../../../../_services/routineSessionsService"

type RouteParams = {
  params: {
    sessionId: string
  }
}

export async function POST(
  request: NextRequest,
  context: RouteParams
): Promise<Response> {
  try {
    const authContext = requireAuthContext()
    const sessionId = ensureUuid(context.params.sessionId, "sessionId")

    if (!authContext.familyId) {
      throw new ForbiddenError("Profile not associated with family")
    }

    const supabase = createSupabaseClient()
    const session = await getSessionDetails(supabase, sessionId, {
      includeTasks: false,
      includePerformance: false
    })

    await ensureProfileInFamily(
      supabase,
      session.childProfileId,
      authContext.familyId
    )

    if (
      authContext.role === "child" &&
      authContext.profileId !== session.childProfileId
    ) {
      throw new ForbiddenError("Children can only complete their own sessions")
    }

    const payload = await readJsonBody(request)
    const command = parseSessionCompletionPayload(payload)

    const result = await completeRoutineSession(
      supabase,
      sessionId,
      command
    )

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    return handleRouteError(error)
  }
}
