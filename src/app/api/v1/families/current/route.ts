import { NextResponse } from "next/server"
import { createSupabaseClient } from "../../../_lib/supabase"
import { handleRouteError, NotFoundError } from "../../../_lib/errors"
import { requireAuthContext } from "../../../_lib/authContext"
import { getFamilyById } from "../../../_services/familiesService"

export async function GET(): Promise<Response> {
  try {
    const context = requireAuthContext()

    if (!context.familyId) {
      throw new NotFoundError("Family not associated with profile")
    }

    const supabase = createSupabaseClient()
    const family = await getFamilyById(supabase, context.familyId)

    return NextResponse.json(family, {
      status: 200,
      headers: {
        "Cache-Control": "private, max-age=30"
      }
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
