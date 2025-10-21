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
import { parseTaskReorderPayload } from "../../../_validators/routine"
import { ensureRoutineInFamily } from "../../../_services/routinesService"
import { ensureProfileInFamily } from "../../../_services/profilesService"
import {
  assertChildAssignedToRoutine
} from "../../../_services/childRoutinesService"
import { reorderRoutineTasks } from "../../../_services/routineTasksService"

export async function PATCH(request: NextRequest): Promise<Response> {
  try {
    const authContext = requireAuthContext()
    assertParentOrAdmin(authContext)

    if (!authContext.familyId) {
      throw new ForbiddenError("Profile not associated with family")
    }

    const payload = await readJsonBody(request)
    const command = parseTaskReorderPayload(payload)

    const routineId = ensureUuid(command.routineId, "routineId")
    const childProfileId = ensureUuid(
      command.childProfileId,
      "childProfileId"
    )

    const supabase = createSupabaseClient()
    await ensureRoutineInFamily(supabase, routineId, authContext.familyId)
    await ensureProfileInFamily(supabase, childProfileId, authContext.familyId)
    await assertChildAssignedToRoutine(supabase, routineId, childProfileId)

    const result = await reorderRoutineTasks(supabase, {
      routineId,
      childProfileId,
      orders: command.orders
    })

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    return handleRouteError(error)
  }
}
