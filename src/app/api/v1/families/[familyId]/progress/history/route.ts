import { NextResponse, type NextRequest } from "next/server"
import {
  assertFamilyAccess,
  assertParentOrAdmin,
  requireAuthContext
} from "../../../../../_lib/authContext"
import { createSupabaseClient } from "../../../../../_lib/supabase"
import { handleRouteError } from "../../../../../_lib/errors"
import { ensureUuid } from "../../../../../_lib/validation"
import { parseFamilyProgressHistoryQuery } from "../../../../../_validators/progress"
import { getFamilyProgressHistory } from "../../../../../_services/familyProgressService"

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

    const query = parseFamilyProgressHistoryQuery(request.nextUrl.searchParams)
    const supabase = createSupabaseClient()

    const history = await getFamilyProgressHistory(supabase, familyId, {
      page: query.page,
      pageSize: query.pageSize,
      fromDate: query.fromDate,
      toDate: query.toDate
    })

    return NextResponse.json(history, { status: 200 })
  } catch (error) {
    return handleRouteError(error)
  }
}
