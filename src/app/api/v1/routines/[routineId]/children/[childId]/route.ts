import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseClient } from "../../../../../_lib/supabase"
import {
  assertParentOrAdmin,
  requireAuthContext
} from "../../../../../_lib/authContext"
import {
  ForbiddenError,
  handleRouteError
} from "../../../../../_lib/errors"
import { ensureUuid } from "../../../../../_lib/validation"
import { readJsonBody } from "../../../../../_lib/request"
import { parseChildRoutineAssignmentPayload } from "../../../../../_validators/routine"
import { ensureRoutineInFamily } from "../../../../../_services/routinesService"
import {
  upsertChildRoutine
} from "../../../../../_services/childRoutinesService"
import { ensureProfileInFamily } from "../../../../../_services/profilesService"

type RouteParams = {
  params: {
    routineId: string
    childId: string
  }
}

export async function PUT(
  request: NextRequest,
  context: RouteParams
): Promise<Response> {
  try {
    const authContext = requireAuthContext()
    assertParentOrAdmin(authContext)

    if (!authContext.familyId) {
      throw new ForbiddenError("Profile not associated with family")
    }

    const routineId = ensureUuid(context.params.routineId, "routineId")
    const childId = ensureUuid(context.params.childId, "childId")

    const payload = await readJsonBody(request)
    const command = parseChildRoutineAssignmentPayload(payload)

    const supabase = createSupabaseClient()
    await ensureRoutineInFamily(supabase, routineId, authContext.familyId)
    await ensureProfileInFamily(supabase, childId, authContext.familyId)

    const assignment = await upsertChildRoutine(
      supabase,
      routineId,
      childId,
      command
    )

    return NextResponse.json(assignment, { status: 200 })
  } catch (error) {
    return handleRouteError(error)
  }
}
