import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseClient } from "../../../_lib/supabase"
import { requireAuthContext } from "../../../_lib/authContext"
import { ForbiddenError, handleRouteError } from "../../../_lib/errors"
import { readJsonBody } from "../../../_lib/request"
import { updateOnboardingState, getOnboardingState } from "../../../_services/onboardingService"

export async function GET(): Promise<Response> {
  try {
    const authContext = requireAuthContext()
    if (!authContext.familyId) {
      throw new ForbiddenError("Profile not associated with family")
    }

    const supabase = createSupabaseClient()
    const state = await getOnboardingState(
      supabase,
      authContext.profileId,
      authContext.familyId
    )

    return NextResponse.json(state, { status: 200 })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const authContext = requireAuthContext()
    if (!authContext.familyId) {
      throw new ForbiddenError("Profile not associated with family")
    }

    const payload = await readJsonBody(request)
    const supabase = createSupabaseClient()
    const state = await updateOnboardingState(
      supabase,
      authContext.profileId,
      authContext.familyId,
      payload
    )

    return NextResponse.json(state, { status: 200 })
  } catch (error) {
    return handleRouteError(error)
  }
}
