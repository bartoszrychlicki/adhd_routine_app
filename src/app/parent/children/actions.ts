"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"

export type PinActionState = {
  status: "idle" | "success" | "error"
  message?: string
}

function resolveOrigin() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? process.env.SITE_URL ?? "http://localhost:3000"
  return base.replace(/\/$/, "")
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

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const message = body?.error?.message ?? "Operacja nie powiodła się."
    throw new Error(message)
  }

  return response
}

export async function updatePinAction(
  _prevState: PinActionState,
  formData: FormData
): Promise<PinActionState> {
  try {
    const childId = formData.get("childId")
    const pin = formData.get("pin")
    const storePlainPinValue = formData.get("storePlainPin")
    const storePlainPin = storePlainPinValue === "true" || storePlainPinValue === "on"

    if (typeof childId !== "string" || childId.length === 0) {
      return { status: "error", message: "Brak identyfikatora dziecka." }
    }

    if (typeof pin !== "string" || pin.trim().length === 0) {
      return { status: "error", message: "PIN jest wymagany." }
    }

    const normalizedPin = pin.trim()
    if (!/^\d{4,6}$/.test(normalizedPin)) {
      return { status: "error", message: "PIN powinien mieć od 4 do 6 cyfr." }
    }

    await performAuthedRequest(`/api/v1/profiles/${childId}/pin`, {
      method: "POST",
      body: JSON.stringify({
        pin: normalizedPin,
        storePlainPin,
      }),
    })

    revalidatePath("/parent/children")
    return { status: "success", message: "PIN został zaktualizowany." }
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Nie udało się zaktualizować PIN-u.",
    }
  }
}
