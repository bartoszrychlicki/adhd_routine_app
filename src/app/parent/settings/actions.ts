"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"

import { getAppBaseUrl } from "@/lib/env"

export type UpdateFamilySettingsState =
  | { status: "idle" }
  | {
      status: "success"
      message: string
      data: {
        familyName: string
        timezone: string
        settings: Record<string, unknown> | null
        updatedAt?: string
      }
    }
  | { status: "error"; message: string }

function resolveOrigin(): string {
  return getAppBaseUrl()
}

async function performAuthedRequest(path: string, init: RequestInit) {
  const cookieHeader = (await cookies()).toString()
  const response = await fetch(`${resolveOrigin()}${path}`, {
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

function readRequiredString(value: FormDataEntryValue | null, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`Pole ${label} jest wymagane.`)
  }

  const trimmed = value.trim()
  if (!trimmed) {
    throw new Error(`Pole ${label} jest wymagane.`)
  }

  return trimmed
}

function parseSettings(value: FormDataEntryValue | null): Record<string, unknown> | null {
  if (value === null) {
    return null
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    return {}
  }

  try {
    const parsed = JSON.parse(value)
    if (parsed === null) {
      return null
    }

    if (typeof parsed === "object") {
      return parsed as Record<string, unknown>
    }
  } catch {
    // fallthrough
  }

  throw new Error("Nie udało się odczytać preferencji rodziny. Odśwież stronę i spróbuj ponownie.")
}

export async function updateFamilySettingsAction(
  _prevState: UpdateFamilySettingsState,
  formData: FormData
): Promise<UpdateFamilySettingsState> {
  try {
    const familyId = readRequiredString(formData.get("familyId"), "familyId")
    const familyName = readRequiredString(formData.get("familyName"), "Nazwa rodziny")
    const timezone = readRequiredString(formData.get("timezone"), "Strefa czasowa")
    const settings = parseSettings(formData.get("settings"))

    const response = await performAuthedRequest(`/api/v1/families/${familyId}`, {
      method: "PATCH",
      body: JSON.stringify({
        familyName,
        timezone,
        settings,
      }),
    })

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
      return {
        status: "error",
        message: data?.error?.message ?? "Nie udało się zapisać zmian.",
      }
    }

    const family = (await response.json().catch(() => null)) as
      | {
          familyName?: string
          timezone?: string
          settings?: Record<string, unknown> | null
          updatedAt?: string
        }
      | null

    revalidatePath("/parent/settings")
    revalidatePath("/parent/dashboard")

    return {
      status: "success",
      message: "Zapisano ustawienia rodziny.",
      data: {
        familyName: typeof family?.familyName === "string" ? family.familyName : familyName,
        timezone: typeof family?.timezone === "string" ? family.timezone : timezone,
        settings: (family?.settings as Record<string, unknown> | null) ?? settings ?? {},
        updatedAt: typeof family?.updatedAt === "string" ? family.updatedAt : undefined,
      },
    }
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Wystąpił nieoczekiwany błąd zapisu.",
    }
  }
}
