"use server"

import { revalidatePath } from "next/cache"

import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase"
import { markOnboardingProgress } from "@/lib/onboarding/progress"
import { REWARD_TEMPLATES } from "@/data/reward-templates"

export type RewardsSetupState = {
  status: "idle" | "success" | "error"
  message?: string
}

export async function saveRewardsSetupAction(
  _prevState: RewardsSetupState,
  formData: FormData
): Promise<RewardsSetupState> {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return { status: "error", message: "Twoja sesja wygasła. Zaloguj się ponownie." }
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, family_id, role")
      .eq("auth_user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle()

    if (profileError || !profile?.family_id) {
      return {
        status: "error",
        message: "Nie znaleziono konta rodzica przypisanego do rodziny.",
      }
    }

    if (profile.role !== "parent" && profile.role !== "admin") {
      return { status: "error", message: "Tylko rodzic może konfigurować nagrody." }
    }

    const familyId = profile.family_id
    const serviceClient = createSupabaseServiceRoleClient()

    const { data: existingRewards, error: rewardsError } = await serviceClient
      .from("rewards")
      .select("id, settings")
      .eq("family_id", familyId)
      .is("deleted_at", null)

    if (rewardsError) {
      console.error("[saveRewardsSetupAction] Failed to load rewards", rewardsError)
      return { status: "error", message: "Nie udało się pobrać nagród. Spróbuj ponownie." }
    }

    const templateIdSet = new Set(
      (existingRewards ?? [])
        .map((reward) => {
          const settings = (reward.settings ?? {}) as { templateId?: string }
          return settings.templateId ?? null
        })
        .filter(Boolean) as string[]
    )

    const selectedTemplates = formData
      .getAll("selectedTemplates")
      .map((value) => (typeof value === "string" ? value : ""))
      .filter(Boolean)

    for (const templateId of selectedTemplates) {
      if (templateIdSet.has(templateId)) {
        continue
      }

      const template = REWARD_TEMPLATES.find((item) => item.id === templateId)
      if (!template) {
        continue
      }

      const { error: insertError } = await serviceClient.from("rewards").insert({
        family_id: familyId,
        name: template.name,
        description: template.description,
        cost_points: template.costPoints,
        is_active: true,
        is_repeatable: true,
        created_by_profile_id: profile.id,
        settings: {
          templateId: template.id,
          imageUrl: template.imageUrl,
          category: template.category,
        },
      })

      if (insertError) {
        console.error("[saveRewardsSetupAction] Failed to insert template reward", templateId, insertError)
        return {
          status: "error",
          message: "Nie udało się dodać wybranej nagrody szablonowej.",
        }
      }
    }

    // Custom reward validation
    const customName = formData.get("customName")
    const customPointsRaw = formData.get("customPoints")
    const customDescription = formData.get("customDescription")
    const isRepeatable = formData.get("customRepeatable") === "true"

    const hasCustomName = typeof customName === "string" && customName.trim().length > 0
    const hasCustomPoints = typeof customPointsRaw === "string" && customPointsRaw.trim().length > 0

    if (hasCustomName || hasCustomPoints) {
      if (!hasCustomName) {
        return {
          status: "error",
          message: "Podaj nazwę dla własnej nagrody lub usuń koszt punktowy.",
        }
      }

      if (!hasCustomPoints) {
        return {
          status: "error",
          message: "Podaj koszt punktowy dla własnej nagrody.",
        }
      }

      const customPoints = Number.parseInt(customPointsRaw as string, 10)
      if (!Number.isFinite(customPoints) || customPoints <= 0) {
        return {
          status: "error",
          message: "Koszt nagrody musi być dodatnią liczbą punktów.",
        }
      }

      const trimmedName = (customName as string).trim()
      const { error: insertCustomError } = await serviceClient.from("rewards").insert({
        family_id: familyId,
        name: trimmedName,
        description: typeof customDescription === "string" ? customDescription.trim() || null : null,
        cost_points: customPoints,
        is_repeatable: isRepeatable,
        is_active: true,
        created_by_profile_id: profile.id,
        settings: {
          source: "custom",
        },
      })

      if (insertCustomError) {
        console.error("[saveRewardsSetupAction] Failed to insert custom reward", insertCustomError)
        return {
          status: "error",
          message: "Nie udało się dodać nagrody własnej.",
        }
      }
    }

    revalidatePath("/onboarding/rewards")
    await markOnboardingProgress({
      profileId: profile.id,
      familyId,
      profileStep: "rewards",
      familyStep: "rewards",
      markComplete: true,
    })

    return {
      status: "success",
      message: "Nagrody zostały zaktualizowane.",
    }
  } catch (error) {
    console.error("[saveRewardsSetupAction] Unexpected error", error)
    return {
      status: "error",
      message: "Wystąpił nieoczekiwany błąd. Spróbuj ponownie później.",
    }
  }
}
