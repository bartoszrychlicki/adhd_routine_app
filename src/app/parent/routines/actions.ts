"use server"

import { revalidatePath } from "next/cache"

import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase"

export async function toggleRoutineActiveAction(formData: FormData): Promise<void> {
  try {
    const routineId = formData.get("routineId")
    const desiredState = formData.get("isActive")

    if (typeof routineId !== "string" || routineId.length === 0) {
      throw new Error("Brak identyfikatora rutyny.")
    }

    const isActive = desiredState === "true"

    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      throw new Error("Twoja sesja wygasła. Zaloguj się ponownie.")
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, family_id")
      .eq("auth_user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle()

    if (profileError || !profile?.family_id) {
      throw new Error("Nie znaleziono profilu rodzica.")
    }

    if (profile.role !== "parent" && profile.role !== "admin") {
      throw new Error("Brak uprawnień do zmiany statusu rutyny.")
    }

    const serviceClient = createSupabaseServiceRoleClient()
    const { error: updateError } = await serviceClient
      .from("routines")
      .update({ is_active: isActive })
      .eq("id", routineId)
      .eq("family_id", profile.family_id)

    if (updateError) {
      console.error("[toggleRoutineActiveAction] update failed", updateError)
      throw new Error("Nie udało się zaktualizować rutyny.")
    }

    revalidatePath("/parent/routines")
  } catch (error) {
    console.error("[toggleRoutineActiveAction] unexpected", error)
    throw error instanceof Error ? error : new Error("Wystąpił nieoczekiwany błąd.")
  }
}
