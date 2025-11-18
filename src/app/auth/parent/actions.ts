"use server"

import { AuthApiError } from "@supabase/supabase-js"
import { redirect } from "next/navigation"

import { createSupabaseServerClient } from "@/lib/supabase"
import { getAppBaseUrl } from "@/lib/env"
import { ensureParentProfile } from "@/lib/auth/ensure-parent-profile"

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
