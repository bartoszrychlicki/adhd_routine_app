import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseClient } from "../../../../_lib/supabase"
import {
  assertParentOrAdmin,
  requireAuthContext
} from "../../../../_lib/authContext"
import {
  ForbiddenError,
  handleRouteError
} from "../../../../_lib/errors"
import { ensureUuid, parseBoolean } from "../../../../_lib/validation"
import { ensureRoutineInFamily } from "../../../../_services/routinesService"
import { listChildAssignments } from "../../../../_services/childRoutinesService"

type RouteParams = {
  params: {
    routineId: string
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
    const supabase = createSupabaseClient()
    await ensureRoutineInFamily(supabase, routineId, authContext.familyId)

    const includeDisabled = parseBoolean(
      request.nextUrl.searchParams.get("includeDisabled"),
      false
    )

    const assignments = await listChildAssignments(
      supabase,
      routineId,
      includeDisabled
    )

    return NextResponse.json(assignments, { status: 200 })
  } catch (error) {
    return handleRouteError(error)
  }
}
