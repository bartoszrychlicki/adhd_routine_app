import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseClient } from "../../../_lib/supabase"
import { requireAuthContext } from "../../../_lib/authContext"
import {
  ForbiddenError,
  handleRouteError
} from "../../../_lib/errors"
import { ensureUuid } from "../../../_lib/validation"
import {
  parseProfileUpdatePayload
} from "../../../_validators/profile"
import {
  ensureProfileInFamily,
  getProfileById,
  updateProfile
} from "../../../_services/profilesService"
import { readJsonBody } from "../../../_lib/request"
import { hasActiveToken } from "../../../_services/tokensService"

type RouteParams = {
  params: {
    profileId: string
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteParams
): Promise<Response> {
  try {
    const authContext = requireAuthContext()
    const profileId = ensureUuid(context.params.profileId, "profileId")

    const payload = await readJsonBody(request)
    const command = parseProfileUpdatePayload(payload)

    if (!authContext.familyId) {
      throw new ForbiddenError("Profile is not associated with a family")
    }

    const supabase = createSupabaseClient()

    if (authContext.role === "child" && authContext.profileId !== profileId) {
      throw new ForbiddenError("Children can only update their own profile")
    }

    const targetProfile = await ensureProfileInFamily(
      supabase,
      profileId,
      authContext.familyId
    )

    if (
      authContext.role !== "parent" &&
      authContext.role !== "admin" &&
      authContext.profileId !== profileId
    ) {
      throw new ForbiddenError("Insufficient permissions to update profile")
    }

    if (targetProfile.role === "parent" && command.deletedAt) {
      throw new ForbiddenError("Parent profile cannot be soft deleted")
    }

    if (command.deletedAt) {
      const activeToken = await hasActiveToken(supabase, profileId)
      if (activeToken) {
        throw new ForbiddenError(
          "Cannot delete profile with active child access token"
        )
      }
    }

    await updateProfile(supabase, profileId, command)

    const updatedProfile = await getProfileById(supabase, profileId)
    return NextResponse.json(updatedProfile, { status: 200 })
  } catch (error) {
    return handleRouteError(error)
  }
}
