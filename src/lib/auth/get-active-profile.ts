import { AuthSessionMissingError } from "@supabase/auth-js"

import { createSupabaseServerClient } from "@/lib/supabase"
import type { Database } from "@/db/database.types"

type ProfileRole = Database["public"]["Enums"]["profile_role"]

export type ActiveProfile = {
  id: string
  familyId: string | null
  role: ProfileRole
  displayName: string
}

/**
 * Returns the active profile for the current Supabase session.
 * When no authenticated session is present, the function resolves to null.
 */
export async function getActiveProfile(): Promise<ActiveProfile | null> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error instanceof AuthSessionMissingError) {
    // Supabase throws when no auth cookie is present; treat as anonymous access.
    return null
  }

  if (error || !user) {
    console.warn("[getActiveProfile] no authenticated user", { error })
    return null
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, family_id, role, display_name")
    .eq("auth_user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle()

  if (profileError || !profile) {
    console.warn("[getActiveProfile] profile not found", {
      userId: user.id,
      profileError,
    })
    return null
  }

  return {
    id: profile.id,
    familyId: profile.family_id,
    role: profile.role,
    displayName: profile.display_name,
  }
}
