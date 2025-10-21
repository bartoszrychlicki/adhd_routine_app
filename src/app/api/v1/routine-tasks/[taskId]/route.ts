import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseClient } from "../../../_lib/supabase"
import {
  assertParentOrAdmin,
  requireAuthContext
} from "../../../_lib/authContext"
import {
  ForbiddenError,
  handleRouteError
} from "../../../_lib/errors"
import { ensureUuid } from "../../../_lib/validation"
import { readJsonBody } from "../../../_lib/request"
import { parseTaskUpdatePayload } from "../../../_validators/routine"
import {
  ensureRoutineInFamily
} from "../../../_services/routinesService"
import {
  getRoutineTaskById,
  updateRoutineTask
} from "../../../_services/routineTasksService"

type RouteParams = {
  params: {
    taskId: string
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteParams
): Promise<Response> {
  try {
    const authContext = requireAuthContext()
    assertParentOrAdmin(authContext)

    if (!authContext.familyId) {
      throw new ForbiddenError("Profile not associated with family")
    }

    const taskId = ensureUuid(context.params.taskId, "taskId")
    const payload = await readJsonBody(request)
    const command = parseTaskUpdatePayload(payload)

    const supabase = createSupabaseClient()
    const taskRow = await getRoutineTaskById(supabase, taskId)
    await ensureRoutineInFamily(supabase, taskRow.routine_id, authContext.familyId)

    const task = await updateRoutineTask(supabase, taskId, command)
    return NextResponse.json(task, { status: 200 })
  } catch (error) {
    return handleRouteError(error)
  }
}
