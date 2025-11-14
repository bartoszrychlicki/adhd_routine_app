import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"
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
  params: Promise<{
    familyId: string
  }>
}

export async function GET(
  request: NextRequest,
  context: RouteParams
): Promise<Response> {
  try {
    const supabase = await createSupabaseServerClient()

    const authContext = await requireAuthContext(supabase)
    assertParentOrAdmin(authContext)

    const { familyId } = await context.params
    const familyIdValidated = ensureUuid(familyId, "familyId")
    assertFamilyAccess(authContext, familyIdValidated)

    const query = parseRoutineListQuery(request.nextUrl.searchParams)
    const offset = (query.page - 1) * query.pageSize
    const routines = await listRoutines(supabase, {
      familyId: familyIdValidated,
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
    const supabase = await createSupabaseServerClient()

    const authContext = await requireAuthContext(supabase)
    assertParentOrAdmin(authContext)

    const { familyId } = await context.params
    const familyIdValidated = ensureUuid(familyId, "familyId")
    assertFamilyAccess(authContext, familyIdValidated)

    const payload = await readJsonBody(request)
    const command = parseRoutineCreatePayload(payload)
    const routine = await createRoutine(supabase, familyIdValidated, command)

    return NextResponse.json(routine, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
