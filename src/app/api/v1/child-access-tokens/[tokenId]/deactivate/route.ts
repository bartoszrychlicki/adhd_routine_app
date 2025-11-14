import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseServerClient, type Database } from "@/lib/supabase"
import {
  assertParentOrAdmin,
  requireAuthContext
} from "../../../../_lib/authContext"
import {
  handleRouteError,
  ForbiddenError,
  mapSupabaseError
} from "../../../../_lib/errors"
import { ensureUuid } from "../../../../_lib/validation"
import { deactivateToken } from "../../../../_services/tokensService"
import { ensureProfileInFamily } from "../../../../_services/profilesService"

type RouteParams = {
  params: Promise<{
    tokenId: string
  }>
}

export async function POST(
  _request: NextRequest,
  context: RouteParams
): Promise<Response> {
  try {
    const supabase = await createSupabaseServerClient()
    const authContext = await requireAuthContext(supabase)
    assertParentOrAdmin(authContext)

    const { tokenId } = await context.params
    const tokenIdValidated = ensureUuid(tokenId, "tokenId")
    const { data, error } = await supabase
      .from("child_access_tokens")
      .select("profile_id")
      .eq("id", tokenIdValidated)
      .maybeSingle()

    if (error) {
      throw mapSupabaseError(error)
    }

    const row = (data as Database["public"]["Tables"]["child_access_tokens"]["Row"] | null) ?? null

    if (!row) {
      throw new ForbiddenError("Token not found")
    }

    const familyId = authContext.familyId
    if (!familyId) {
      throw new ForbiddenError("Profile not associated with family")
    }

    await ensureProfileInFamily(supabase, row.profile_id, familyId)

    const result = await deactivateToken(
      supabase,
      row.profile_id,
      tokenIdValidated,
      authContext.profileId
    )

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    return handleRouteError(error)
  }
}
