"use server"

import { revalidatePath } from "next/cache"
import { headers, cookies } from "next/headers"

import { createSupabaseServerClient } from "@/lib/supabase"
import { markOnboardingProgress } from "@/lib/onboarding/progress"

type ActionStatus = "idle" | "success" | "error"

type FamilyFormState = {
  status: ActionStatus
  message?: string
}

function readStringField(value: FormDataEntryValue | null, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`Pole ${field} jest wymagane.`)
  }

  const trimmed = value.trim()
  if (!trimmed) {
    throw new Error(`Pole ${field} jest wymagane.`)
  }

  return trimmed
}

async function resolveOrigin(): Promise<string> {
  const headerStore = await headers()
  const origin = headerStore.get("origin")
  if (origin) {
    return origin
  }

  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }

  return "http://localhost:3000"
}

async function performJsonRequest(input: RequestInfo, init: RequestInit): Promise<Response> {
  const cookieHeader = (await cookies()).toString()
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  })

  return response
}

export async function updateFamilyAction(
  _prevState: FamilyFormState,
  formData: FormData
): Promise<FamilyFormState> {
  try {
    const familyId = readStringField(formData.get("familyId"), "familyId")
    const familyName = readStringField(formData.get("familyName"), "Nazwa rodziny")
    const timezone = readStringField(formData.get("timezone"), "Strefa czasowa")

    const origin = await resolveOrigin()
    const response = await performJsonRequest(`${origin}/api/v1/families/${familyId}`, {
      method: "PATCH",
      body: JSON.stringify({
        familyName,
        timezone,
      }),
    })

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
      return {
        status: "error",
        message: data?.error?.message ?? "Nie udało się zapisać danych rodziny.",
      }
    }

    revalidatePath("/onboarding/family")
    await markFamilyStep()
    return { status: "success", message: "Dane rodziny zostały zapisane." }
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Wystąpił nieoczekiwany błąd.",
    }
  }
}

type ChildFormState = {
  status: ActionStatus
  message?: string
}

async function markFamilyStep() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, family_id")
    .eq("auth_user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle()

  if (!profile?.id || !profile.family_id) {
    return
  }

  await markOnboardingProgress({
    profileId: profile.id,
    familyId: profile.family_id,
    profileStep: "family",
    familyStep: "family",
  })
}

export async function createChildProfileAction(
  _prevState: ChildFormState,
  formData: FormData
): Promise<ChildFormState> {
  try {
    const familyId = readStringField(formData.get("familyId"), "familyId")
    const displayName = readStringField(formData.get("displayName"), "Imię dziecka")
    const rawPin = typeof formData.get("pin") === "string" ? (formData.get("pin") as string).trim() : ""
    const pin = rawPin.length === 0 ? null : rawPin

    if (pin && !/^[0-9]{4,6}$/.test(pin)) {
      return {
        status: "error",
        message: "PIN powinien zawierać 4–6 cyfr.",
      }
    }

    const origin = await resolveOrigin()
    const response = await performJsonRequest(`${origin}/api/v1/families/${familyId}/profiles`, {
      method: "POST",
      body: JSON.stringify({
        displayName,
        role: "child",
        email: null,
        avatarUrl: null,
        pin,
        settings: {},
      }),
    })

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
      return {
        status: "error",
        message: data?.error?.message ?? "Nie udało się dodać profilu dziecka.",
      }
    }

    revalidatePath("/onboarding/family")
    await markFamilyStep()
    return {
      status: "success",
      message: pin
        ? "Dodano dziecko i przypisano PIN. Możesz przekazać go Erykowi."
        : "Dodano dziecko. PIN możesz ustawić później w panelu rodzica.",
    }
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Wystąpił nieoczekiwany błąd.",
    }
  }
}
