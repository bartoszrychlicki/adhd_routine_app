import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseClient } from "../../../../../_lib/supabase"
import { assertParentOrAdmin, requireAuthContext } from "../../../../../_lib/authContext"
import { ForbiddenError, handleRouteError } from "../../../../../_lib/errors"
import { ensureUuid } from "../../../../../_lib/validation"
import { readJsonBody } from "../../../../../_lib/request"
import { parseSessionSkipPayload } from "../../../../../_validators/session"
import { ensureProfileInFamily } from "../../../../../_services/profilesService"
import {
  getSessionDetails,
  skipRoutineSession
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
    assertParentOrAdmin(authContext)
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

    const payload = await readJsonBody(request)
    const command = parseSessionSkipPayload(payload)

    const result = await skipRoutineSession(supabase, sessionId, command)
    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    return handleRouteError(error)
  }
}
