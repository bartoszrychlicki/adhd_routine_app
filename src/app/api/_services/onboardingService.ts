import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/db/database.types"
import type { OnboardingStateDto, OnboardingStateUpdateCommand } from "@/types"
import { mapSupabaseError, NotFoundError } from "../_lib/errors"

type Client = SupabaseClient<Database>

export async function getOnboardingState(
  client: Client,
  profileId: string,
  familyId: string
): Promise<OnboardingStateDto> {
  const [{ data: profile, error: profileError }, { data: family, error: familyError }] =
    await Promise.all([
      client
        .from("profiles")
        .select("settings")
        .eq("id", profileId)
        .maybeSingle(),
      client
        .from("families")
        .select("settings")
        .eq("id", familyId)
        .maybeSingle()
    ])

  if (profileError) {
    throw mapSupabaseError(profileError)
  }
  if (familyError) {
    throw mapSupabaseError(familyError)
  }

  if (!profile || !family) {
    throw new NotFoundError("Onboarding state not found")
  }

  return {
    profile: profile.settings?.onboarding ?? {},
    family: family.settings?.onboarding ?? {}
  }
}

export async function updateOnboardingState(
  client: Client,
  profileId: string,
  familyId: string,
  command: OnboardingStateUpdateCommand
): Promise<OnboardingStateDto> {
  const [{ data: profileRow, error: profileError }, { data: familyRow, error: familyError }] =
    await Promise.all([
      client
        .from("profiles")
        .select("settings")
        .eq("id", profileId)
        .maybeSingle(),
      client
        .from("families")
        .select("settings")
        .eq("id", familyId)
        .maybeSingle()
    ])

  if (profileError) {
    throw mapSupabaseError(profileError)
  }
  if (familyError) {
    throw mapSupabaseError(familyError)
  }

  const profileSettings = { ...(profileRow?.settings ?? {}) }
  const familySettings = { ...(familyRow?.settings ?? {}) }

  if (command.profileSteps) {
    const currentProfile = { ...(profileSettings.onboarding ?? {}) }
    currentProfile.completedSteps = command.profileSteps
    if (typeof command.isComplete !== "undefined") {
      currentProfile.isComplete = command.isComplete
    }
    profileSettings.onboarding = currentProfile
  }

  if (command.familySteps) {
    const currentFamily = { ...(familySettings.onboarding ?? {}) }
    currentFamily.completedSteps = command.familySteps
    if (typeof command.isComplete !== "undefined") {
      currentFamily.isComplete = command.isComplete
    }
    familySettings.onboarding = currentFamily
  }

  if (command.profileSteps || typeof command.isComplete !== "undefined") {
    const { error } = await client
      .from("profiles")
      .update({ settings: profileSettings })
      .eq("id", profileId)

    if (error) {
      throw mapSupabaseError(error)
    }
  }

  if (command.familySteps || typeof command.isComplete !== "undefined") {
    const { error } = await client
      .from("families")
      .update({ settings: familySettings })
      .eq("id", familyId)

    if (error) {
      throw mapSupabaseError(error)
    }
  }

  return getOnboardingState(client, profileId, familyId)
}
