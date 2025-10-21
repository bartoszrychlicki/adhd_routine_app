import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseClient } from "../../../../../../_lib/supabase"
import {
  assertParentOrAdmin,
  requireAuthContext
} from "../../../../../../_lib/authContext"
import {
  ForbiddenError,
  handleRouteError
} from "../../../../../../_lib/errors"
import { ensureUuid } from "../../../../../../_lib/validation"
import { readJsonBody } from "../../../../../../_lib/request"
import { parseChildRoutineReorderPayload } from "../../../../../../_validators/routine"
import {
  ensureRoutineInFamily
} from "../../../../../../_services/routinesService"
import {
  reorderChildRoutines
} from "../../../../../../_services/childRoutinesService"

type RouteParams = {
  params: {
    routineId: string
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

    const routineId = ensureUuid(context.params.routineId, "routineId")
    const supabase = createSupabaseClient()
    await ensureRoutineInFamily(supabase, routineId, authContext.familyId)

    const payload = await readJsonBody(request)
    const command = parseChildRoutineReorderPayload(payload)

    const result = await reorderChildRoutines(supabase, routineId, command)
    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    return handleRouteError(error)
  }
}
