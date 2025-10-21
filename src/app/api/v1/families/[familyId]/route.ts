import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseClient } from "../../../_lib/supabase"
import {
  assertFamilyAccess,
  assertParentOrAdmin,
  requireAuthContext
} from "../../../_lib/authContext"
import { handleRouteError } from "../../../_lib/errors"
import { parseFamilyUpdatePayload } from "../../../_validators/family"
import { updateFamily } from "../../../_services/familiesService"
import { ensureUuid } from "../../../_lib/validation"
import { readJsonBody } from "../../../_lib/request"

type RouteParams = {
  params: {
    familyId: string
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteParams
): Promise<Response> {
  try {
    const authContext = requireAuthContext()
    assertParentOrAdmin(authContext)

    const familyId = ensureUuid(context.params.familyId, "familyId")
    assertFamilyAccess(authContext, familyId)

    const payload = await readJsonBody(request)
    const command = parseFamilyUpdatePayload(payload)

    const supabase = createSupabaseClient()
    const family = await updateFamily(supabase, familyId, command)

    return NextResponse.json(family, { status: 200 })
  } catch (error) {
    return handleRouteError(error)
  }
}
