import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseClient } from "../../../../_lib/supabase"
import {
  assertFamilyAccess,
  assertParentOrAdmin,
  requireAuthContext
} from "../../../../_lib/authContext"
import { handleRouteError } from "../../../../_lib/errors"
import { ensureUuid } from "../../../../_lib/validation"
import { readJsonBody } from "../../../../_lib/request"
import {
  parseRoutineCreatePayload,
  parseRoutineListQuery
} from "../../../../_validators/routine"
import {
  createRoutine,
  listRoutines
} from "../../../../_services/routinesService"

type RouteParams = {
  params: {
    familyId: string
  }
}

export async function GET(
  request: NextRequest,
  context: RouteParams
): Promise<Response> {
  try {
    const authContext = requireAuthContext()
    assertParentOrAdmin(authContext)

    const familyId = ensureUuid(context.params.familyId, "familyId")
    assertFamilyAccess(authContext, familyId)

    const query = parseRoutineListQuery(request.nextUrl.searchParams)
    const offset = (query.page - 1) * query.pageSize

    const supabase = createSupabaseClient()
    const routines = await listRoutines(supabase, {
      familyId,
      routineType: query.routineType,
      isActive: query.isActive,
      includeDeleted: query.includeDeleted,
      limit: query.pageSize,
      offset,
      sort: query.sort,
      order: query.order
    })

    return NextResponse.json(routines, { status: 200 })
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

    const familyId = ensureUuid(context.params.familyId, "familyId")
    assertFamilyAccess(authContext, familyId)

    const payload = await readJsonBody(request)
    const command = parseRoutineCreatePayload(payload)

    const supabase = createSupabaseClient()
    const routine = await createRoutine(supabase, familyId, command)

    return NextResponse.json(routine, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
