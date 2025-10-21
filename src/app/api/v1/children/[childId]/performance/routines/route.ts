import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseClient } from "../../../../../../_lib/supabase"
import { requireAuthContext } from "../../../../../../_lib/authContext"
import {
  ForbiddenError,
  handleRouteError
} from "../../../../../../_lib/errors"
import { ensureUuid } from "../../../../../../_lib/validation"
import { ensureProfileInFamily } from "../../../../../../_services/profilesService"
import { listRoutinePerformance } from "../../../../../../_services/performanceService"

type RouteParams = {
  params: {
    childId: string
  }
}

export async function GET(
  request: NextRequest,
  context: RouteParams
): Promise<Response> {
  try {
    const authContext = requireAuthContext()
    const childId = ensureUuid(context.params.childId, "childId")

    if (!authContext.familyId) {
      throw new ForbiddenError("Profile not associated with family")
    }

    if (authContext.role === "child" && authContext.profileId !== childId) {
      throw new ForbiddenError("Children can only view their own stats")
    }

    const supabase = createSupabaseClient()
    await ensureProfileInFamily(supabase, childId, authContext.familyId)

    const routineId = request.nextUrl.searchParams.get("routineId") ?? undefined
    const stats = await listRoutinePerformance(supabase, childId, routineId)

    return NextResponse.json(stats, { status: 200 })
  } catch (error) {
    return handleRouteError(error)
  }
}
