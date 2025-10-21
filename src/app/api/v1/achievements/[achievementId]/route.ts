import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseClient } from "../../../_lib/supabase"
import { assertParentOrAdmin, requireAuthContext } from "../../../_lib/authContext"
import { ForbiddenError, handleRouteError, mapSupabaseError } from "../../../_lib/errors"
import { ensureUuid } from "../../../_lib/validation"
import { readJsonBody } from "../../../_lib/request"
import { parseUpdateAchievementPayload } from "../../../_validators/reward"
import { updateAchievement } from "../../../_services/achievementsService"

async function ensureAchievementFamily(
  achievementId: string,
  familyId: string
): Promise<void> {
  const supabase = createSupabaseClient()
  const { data, error } = await supabase
    .from("achievements")
    .select("family_id")
    .eq("id", achievementId)
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  if (!data) {
    throw new ForbiddenError("Achievement not found")
  }

  if (data.family_id && data.family_id !== familyId) {
    throw new ForbiddenError("Achievement does not belong to this family")
  }
}

type RouteParams = {
  params: {
    achievementId: string
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteParams
): Promise<Response> {
  try {
    const authContext = requireAuthContext()
    assertParentOrAdmin(authContext)

    const achievementId = ensureUuid(context.params.achievementId, "achievementId")
    const familyId = authContext.familyId
    if (!familyId) {
      throw new ForbiddenError("Profile not associated with family")
    }

    await ensureAchievementFamily(achievementId, familyId)
    const payload = await readJsonBody(request)
    const command = parseUpdateAchievementPayload(payload)

    const supabase = createSupabaseClient()
    const achievement = await updateAchievement(supabase, achievementId, command)

    return NextResponse.json(achievement, { status: 200 })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteParams
): Promise<Response> {
  try {
    const authContext = requireAuthContext()
    assertParentOrAdmin(authContext)

    const achievementId = ensureUuid(context.params.achievementId, "achievementId")
    const familyId = authContext.familyId
    if (!familyId) {
      throw new ForbiddenError("Profile not associated with family")
    }

    await ensureAchievementFamily(achievementId, familyId)
    const supabase = createSupabaseClient()
    await updateAchievement(supabase, achievementId, { deletedAt: new Date().toISOString(), isActive: false })

    return NextResponse.json({ message: "Achievement archived" }, { status: 200 })
  } catch (error) {
    return handleRouteError(error)
  }
}
