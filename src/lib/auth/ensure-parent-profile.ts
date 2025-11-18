import type { User } from "@supabase/supabase-js"

import type { Database } from "@/db/database.types"
import { createSupabaseServiceRoleClient } from "@/lib/supabase"

export async function ensureParentProfile(user: User | null) {
  if (!user) {
    return
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("[ensureParentProfile] Missing SUPABASE_SERVICE_ROLE_KEY; skipping automatic provisioning.")
    return
  }

  const serviceClient = createSupabaseServiceRoleClient()

  type ParentProfileRow = Pick<Database["public"]["Tables"]["profiles"]["Row"], "id" | "family_id">

  const { data: existingProfileRaw, error: fetchError } = await serviceClient
    .from("profiles")
    .select("id, family_id")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  if (fetchError) {
    console.error("[ensureParentProfile] Failed to check existing profile", fetchError)
    return
  }

  const existingProfile = (existingProfileRaw as ParentProfileRow | null) ?? null

  if (existingProfile?.family_id) {
    return
  }

  const displayName =
    (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.length > 0
      ? user.user_metadata.full_name
      : user.email?.split("@")[0]) ?? "Rodzic"

  let familyId = existingProfile?.family_id ?? null

  if (!familyId) {
    const { data: newFamilyRaw, error: familyError } = await serviceClient
      .from("families")
      .insert({
        family_name: `Rodzina ${displayName}`,
        timezone: "Europe/Warsaw",
        settings: {
          onboarding: {
            completedSteps: [],
            isComplete: false,
          },
        },
      })
      .select("id")
      .maybeSingle()

    type FamilyRow = Pick<Database["public"]["Tables"]["families"]["Row"], "id">
    const newFamily = (newFamilyRaw as FamilyRow | null) ?? null

    if (familyError || !newFamily) {
      console.error("[ensureParentProfile] Failed to create family", familyError)
      return
    }

    familyId = newFamily.id
  }

  const { error: profileInsertError } = await serviceClient.from("profiles").insert({
    auth_user_id: user.id,
    display_name: displayName,
    email: user.email,
    family_id: familyId,
    role: "parent",
    settings: {
      onboarding: {
        completedSteps: [],
        isComplete: false,
      },
    },
  })

  if (profileInsertError) {
    if (profileInsertError.code === "23503") {
      console.info("[ensureParentProfile] Auth user not yet replicated; profile provisioning deferred.", {
        userId: user.id,
      })
      return
    }

    console.error("[ensureParentProfile] Failed to create profile", profileInsertError)
  }
}
