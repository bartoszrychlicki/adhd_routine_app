"use server"

import { revalidatePath } from "next/cache"

import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase"

async function getParentContext() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: "Twoja sesja wygasła. Zaloguj się ponownie." } as const
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, family_id, role")
    .eq("auth_user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle()

  if (profileError || !profile?.family_id) {
    return { error: "Nie znaleziono profilu rodzica." } as const
  }

  if (profile.role !== "parent" && profile.role !== "admin") {
    return { error: "Brak uprawnień do zarządzania nagrodami." } as const
  }

  return {
    profileId: profile.id,
    familyId: profile.family_id,
  } as const
}

export async function toggleRewardActiveAction(formData: FormData): Promise<void> {
  try {
    const context = await getParentContext()
    if ("error" in context) {
      throw new Error(context.error)
    }

    const rewardId = formData.get("rewardId")
    const isActive = formData.get("isActive") === "true"

    if (typeof rewardId !== "string" || rewardId.length === 0) {
      throw new Error("Brak identyfikatora nagrody.")
    }

    const supabase = createSupabaseServiceRoleClient()
    const { error: updateError } = await supabase
      .from("rewards")
      .update({ is_active: isActive })
      .eq("id", rewardId)
      .eq("family_id", context.familyId)

    if (updateError) {
      console.error("[toggleRewardActiveAction] failed", updateError)
      throw new Error("Nie udało się zmienić statusu nagrody.")
    }

    revalidatePath("/parent/rewards")
  } catch (error) {
    console.error("[toggleRewardActiveAction] unexpected", error)
    throw error instanceof Error ? error : new Error("Wystąpił nieoczekiwany błąd.")
  }
}
