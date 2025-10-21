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
import {
  parseTaskCreatePayload,
  parseTaskListQuery
} from "../../../../../../_validators/routine"
import { ensureRoutineInFamily } from "../../../../../../_services/routinesService"
import {
  assertChildAssignedToRoutine
} from "../../../../../../_services/childRoutinesService"
import {
  createRoutineTask,
  listRoutineTasks
} from "../../../../../../_services/routineTasksService"
import { ensureProfileInFamily } from "../../../../../../_services/profilesService"

type RouteParams = {
  params: {
    routineId: string
    childId: string
  }
}

export async function GET(
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

    const supabase = createSupabaseClient()
    await ensureRoutineInFamily(supabase, routineId, authContext.familyId)
    await ensureProfileInFamily(supabase, childId, authContext.familyId)
    await assertChildAssignedToRoutine(supabase, routineId, childId)

    const query = parseTaskListQuery(request.nextUrl.searchParams)
    const tasks = await listRoutineTasks(supabase, routineId, childId, {
      includeInactive: query.includeInactive,
      sort: query.sort,
      order: query.order
    })

    return NextResponse.json(tasks, { status: 200 })
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
    assertParentOrAdmin(authContext)

    if (!authContext.familyId) {
      throw new ForbiddenError("Profile not associated with family")
    }

    const routineId = ensureUuid(context.params.routineId, "routineId")
    const childId = ensureUuid(context.params.childId, "childId")

    const payload = await readJsonBody(request)
    const command = parseTaskCreatePayload(payload)

    const supabase = createSupabaseClient()
    await ensureRoutineInFamily(supabase, routineId, authContext.familyId)
    await ensureProfileInFamily(supabase, childId, authContext.familyId)
    await assertChildAssignedToRoutine(supabase, routineId, childId)

    const task = await createRoutineTask(supabase, routineId, childId, command)
    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
