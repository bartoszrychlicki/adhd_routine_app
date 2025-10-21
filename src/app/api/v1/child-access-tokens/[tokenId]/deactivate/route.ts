import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseClient } from "../../../../../_lib/supabase"
import {
  assertParentOrAdmin,
  requireAuthContext
} from "../../../../../_lib/authContext"
import {
  handleRouteError,
  ForbiddenError,
  mapSupabaseError
} from "../../../../../_lib/errors"
import { ensureUuid } from "../../../../../_lib/validation"
import { deactivateToken } from "../../../../../_services/tokensService"
import { ensureProfileInFamily } from "../../../../../_services/profilesService"
import { mapSupabaseError } from "../../../../../_lib/errors"

type RouteParams = {
  params: {
    tokenId: string
  }
}

export async function POST(
  _request: NextRequest,
  context: RouteParams
): Promise<Response> {
  try {
    const authContext = requireAuthContext()
    assertParentOrAdmin(authContext)

    const tokenId = ensureUuid(context.params.tokenId, "tokenId")
    const supabase = createSupabaseClient()

    const { data, error } = await supabase
      .from("child_access_tokens")
      .select("profile_id")
      .eq("id", tokenId)
      .maybeSingle()

    if (error) {
      throw mapSupabaseError(error)
    }

    if (!data) {
      throw new ForbiddenError("Token not found")
    }

    await ensureProfileInFamily(supabase, data.profile_id, authContext.familyId)

    const result = await deactivateToken(
      supabase,
      data.profile_id,
      tokenId,
      authContext.profileId
    )

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    return handleRouteError(error)
  }
}
