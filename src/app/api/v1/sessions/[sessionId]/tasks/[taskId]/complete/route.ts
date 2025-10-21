import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseClient } from "../../../../../../_lib/supabase"
import { requireAuthContext } from "../../../../../../_lib/authContext"
import {
  ForbiddenError,
  handleRouteError
} from "../../../../../../_lib/errors"
import { ensureUuid } from "../../../../../../_lib/validation"
import { readJsonBody } from "../../../../../../_lib/request"
import { parseTaskCompletionPayload } from "../../../../../../_validators/session"
import { ensureProfileInFamily } from "../../../../../../_services/profilesService"
import {
  completeTaskForSession,
  getSessionDetails
} from "../../../../../../_services/routineSessionsService"

type RouteParams = {
  params: {
    sessionId: string
    taskId: string
  }
}

export async function POST(
  request: NextRequest,
  context: RouteParams
): Promise<Response> {
  try {
    const authContext = requireAuthContext()
    const sessionId = ensureUuid(context.params.sessionId, "sessionId")
    const taskId = ensureUuid(context.params.taskId, "taskId")

    const payload = await readJsonBody(request)
    const command = parseTaskCompletionPayload(payload)

    const supabase = createSupabaseClient()
    const session = await getSessionDetails(supabase, sessionId, {
      includeTasks: false,
      includePerformance: false
    })

    if (!authContext.familyId) {
      throw new ForbiddenError("Profile not associated with family")
    }

    await ensureProfileInFamily(
      supabase,
      session.childProfileId,
      authContext.familyId
    )

    if (
      authContext.role === "child" &&
      authContext.profileId !== session.childProfileId
    ) {
      throw new ForbiddenError("Children can only complete tasks for their own sessions")
    }

    const result = await completeTaskForSession(
      supabase,
      sessionId,
      taskId,
      command
    )

    return NextResponse.json(
      {
        taskCompletionId: result.id,
        position: result.position,
        status: "completed"
      },
      { status: 200 }
    )
  } catch (error) {
    return handleRouteError(error)
  }
}
