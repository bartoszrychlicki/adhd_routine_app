import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"
import type { Database } from "@/db/database.types"
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
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("achievements" satisfies keyof Database["public"]["Tables"])
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
  params: Promise<{
    achievementId: string
  }>
}

export async function PATCH(
  request: NextRequest,
  context: RouteParams
): Promise<Response> {
  try {
    const supabase = await createSupabaseServerClient()
    const authContext = await requireAuthContext(supabase)
    assertParentOrAdmin(authContext)

    const { achievementId } = await context.params
    const achievementIdValidated = ensureUuid(achievementId, "achievementId")
    const familyId = authContext.familyId
    if (!familyId) {
      throw new ForbiddenError("Profile not associated with family")
    }

    await ensureAchievementFamily(achievementIdValidated, familyId)
    const payload = await readJsonBody(request)
    const command = parseUpdateAchievementPayload(payload)

    const achievement = await updateAchievement(supabase, achievementIdValidated, command)

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
    const supabase = await createSupabaseServerClient()
    const authContext = await requireAuthContext(supabase)
    assertParentOrAdmin(authContext)

    const { achievementId } = await context.params
    const achievementIdValidated = ensureUuid(achievementId, "achievementId")
    const familyId = authContext.familyId
    if (!familyId) {
      throw new ForbiddenError("Profile not associated with family")
    }

    await ensureAchievementFamily(achievementIdValidated, familyId)
    await updateAchievement(supabase, achievementIdValidated, { deletedAt: new Date().toISOString(), isActive: false })

    return NextResponse.json({ message: "Achievement archived" }, { status: 200 })
  } catch (error) {
    return handleRouteError(error)
  }
}
