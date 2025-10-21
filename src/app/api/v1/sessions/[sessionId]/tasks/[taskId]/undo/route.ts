import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseClient } from "../../../../../../../_lib/supabase"
import { requireAuthContext } from "../../../../../../../_lib/authContext"
import {
  ForbiddenError,
  handleRouteError
} from "../../../../../../../_lib/errors"
import { ensureUuid } from "../../../../../../../_lib/validation"
import { ensureProfileInFamily } from "../../../../../../../_services/profilesService"
import {
  getSessionDetails,
  undoTaskCompletion
} from "../../../../../../../_services/routineSessionsService"

type RouteParams = {
  params: {
    sessionId: string
    taskId: string
  }
}

export async function POST(
  _request: NextRequest,
  context: RouteParams
): Promise<Response> {
  try {
    const authContext = requireAuthContext()
    const sessionId = ensureUuid(context.params.sessionId, "sessionId")
    const completionId = ensureUuid(context.params.taskId, "taskCompletionId")

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

    if (authContext.role === "child") {
      throw new ForbiddenError("Only parents can undo task completions")
    }

    await undoTaskCompletion(supabase, sessionId, completionId)

    return NextResponse.json(
      { message: "Task completion reverted" },
      { status: 200 }
    )
  } catch (error) {
    return handleRouteError(error)
  }
}
