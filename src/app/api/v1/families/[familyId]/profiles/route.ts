import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseClient } from "../../../../_lib/supabase"
import {
  assertFamilyAccess,
  assertParentOrAdmin,
  requireAuthContext
} from "../../../../_lib/authContext"
import { handleRouteError } from "../../../../_lib/errors"
import { ensureUuid } from "../../../../_lib/validation"
import {
  parseCreateChildProfilePayload,
  parseProfilesListQuery
} from "../../../../_validators/profile"
import {
  createChildProfile,
  listProfiles
} from "../../../../_services/profilesService"
import { readJsonBody } from "../../../../_lib/request"

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

    const query = parseProfilesListQuery(request.nextUrl.searchParams)
    const offset = (query.page - 1) * query.pageSize

    const supabase = createSupabaseClient()
    const result = await listProfiles(supabase, {
      familyId,
      role: query.role,
      includeDeleted: query.includeDeleted,
      limit: query.pageSize,
      offset,
      sort: query.sort,
      order: query.order
    })

    return NextResponse.json(result, { status: 200 })
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
    const command = parseCreateChildProfilePayload(payload)

    const supabase = createSupabaseClient()
    const profile = await createChildProfile(supabase, familyId, command)

    return NextResponse.json(profile, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
