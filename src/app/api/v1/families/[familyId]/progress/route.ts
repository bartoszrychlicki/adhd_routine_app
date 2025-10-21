import { NextResponse, type NextRequest } from "next/server"
import { addDays } from "date-fns"
import { createSupabaseClient } from "../../../../_lib/supabase"
import {
  assertFamilyAccess,
  assertParentOrAdmin,
  requireAuthContext
} from "../../../../_lib/authContext"
import { handleRouteError } from "../../../../_lib/errors"
import { ensureUuid } from "../../../../_lib/validation"
import { parseFamilyProgressQuery } from "../../../../_validators/progress"
import { getDailyFamilyProgress } from "../../../../_services/familyProgressService"

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

    const query = parseFamilyProgressQuery(request.nextUrl.searchParams)
    const supabase = createSupabaseClient()

    const current = await getDailyFamilyProgress(
      supabase,
      familyId,
      query.date
    )

    if (!query.includeHistory) {
      return NextResponse.json(current, { status: 200 })
    }

    const previousDate = addDays(new Date(`${query.date}T00:00:00Z`), -1)
    const previousSummary = await getDailyFamilyProgress(
      supabase,
      familyId,
      previousDate.toISOString().slice(0, 10)
    )

    return NextResponse.json(
      {
        ...current,
        history: {
          previousDay: previousSummary
        }
      },
      { status: 200 }
    )
  } catch (error) {
    return handleRouteError(error)
  }
}
