"use server"

import { AuthApiError, type User } from "@supabase/supabase-js"
import { redirect } from "next/navigation"

import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase"
import type { Database } from "@/db/database.types"
import { getAppBaseUrl } from "@/lib/env"

type LoginState =
  | { status: "idle" }
  | { status: "error"; message: string }

export type SignupState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string }

function validateEmail(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null
  }

  const email = value.trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return null
  }

  return email
}

function validatePassword(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.length < 6) {
    return null
  }

  return value
}

function resolveEmailRedirect(): string | undefined {
  try {
    const url = new URL(getAppBaseUrl())
    url.pathname = "/auth/parent/confirm"
    return url.toString()
  } catch {
    return undefined
  }
}

async function ensureParentProfile(user: User | null) {
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
    console.error("[ensureParentProfile] Failed to create profile", profileInsertError)
  }
}

export async function signUpParent(
  _prevState: SignupState,
  formData: FormData
): Promise<SignupState> {
  console.log("[signUpParent] start")
  const email = validateEmail(formData.get("email"))
  const password = validatePassword(formData.get("password"))
  const confirmPassword = formData.get("confirmPassword")
  const acceptTerms = formData.get("acceptTerms") === "true"

  if (!email || !password) {
    console.warn("[signUpParent] invalid email or password", { emailProvided: Boolean(email) })
    return {
      status: "error",
      message: "Podaj prawidłowy adres email i hasło (min. 6 znaków).",
    }
  }

  if (typeof confirmPassword !== "string" || confirmPassword !== password) {
    console.warn("[signUpParent] password mismatch")
    return {
      status: "error",
      message: "Hasła muszą być identyczne.",
    }
  }

  if (!acceptTerms) {
    console.warn("[signUpParent] terms not accepted")
    return {
      status: "error",
      message: "Aby założyć konto, musisz zaakceptować regulamin.",
    }
  }

  const supabase = await createSupabaseServerClient({ allowCookiePersistence: true })
  console.log("[signUpParent] calling supabase.auth.signUp", {
    redirectTo: resolveEmailRedirect(),
  })
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role: "parent",
      },
      emailRedirectTo: resolveEmailRedirect(),
    },
  })

  if (error) {
    console.error("[signUpParent] supabase error", error)
    if (error instanceof AuthApiError && error.status === 400) {
      return {
        status: "error",
        message:
          "Nie mogliśmy utworzyć konta. Upewnij się, że email nie jest już zarejestrowany lub spróbuj odzyskać hasło.",
      }
    }

    return {
      status: "error",
      message: "Wystąpił błąd podczas rejestracji. Spróbuj ponownie później.",
    }
  }

  if (data.session) {
    await ensureParentProfile(data.user)
    console.log("[signUpParent] session created, redirecting")
    redirect("/parent/dashboard")
  }

  await ensureParentProfile(data.user)
  console.log("[signUpParent] success without session (awaiting email confirmation)")
  return {
    status: "success",
    message:
      "Jeśli podany adres email jest poprawny, wysłaliśmy link aktywacyjny. Sprawdź skrzynkę i potwierdź rejestrację.",
  }
}

export async function loginParent(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  console.log("[loginParent] start")
  const email = validateEmail(formData.get("email"))
  const password = validatePassword(formData.get("password"))

  if (!email || !password) {
    console.warn("[loginParent] invalid input", { emailProvided: Boolean(email) })
    return {
      status: "error",
      message: "Sprawdź poprawność adresu email i hasła.",
    }
  }

  const supabase = await createSupabaseServerClient({ allowCookiePersistence: true })
  console.log("[loginParent] calling supabase.auth.signInWithPassword")
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    console.error("[loginParent] supabase error", error)
    if (error instanceof AuthApiError && error.status === 400) {
      return {
        status: "error",
        message: "Nieprawidłowe dane logowania lub konto nie istnieje.",
      }
    }

    return {
      status: "error",
      message: "Nie udało się zalogować. Spróbuj ponownie później.",
    }
  }

  if (!data.session) {
    console.warn("[loginParent] sign-in returned no session", {
      user: data.user?.id,
      emailConfirmedAt: data.user?.email_confirmed_at,
    })
    return {
      status: "error",
      message:
        "Logowanie nie powiodło się. Upewnij się, że potwierdziłeś adres email i spróbuj ponownie.",
    }
  }

  await ensureParentProfile(data.user)
  console.log("[loginParent] login success, redirecting")
  redirect("/parent/dashboard")
}

export async function logoutParent(): Promise<void> {
  const supabase = await createSupabaseServerClient({ allowCookiePersistence: true })

  try {
    await supabase.auth.signOut({ scope: "global" })
  } catch (error) {
    console.error("[logoutParent] Failed to sign out", error)
  }

  redirect("/auth/parent?status=logged_out")
}
