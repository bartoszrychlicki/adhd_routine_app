import type { Page } from "@playwright/test"

import type { SupabaseSessionCookie } from "./supabase-admin"

type SameSiteAttribute = "Lax" | "Strict" | "None"
type RawSameSite = NonNullable<SupabaseSessionCookie["options"]>["sameSite"]

type ChildSessionInput = {
  childId: string
  familyId: string
  displayName: string
  durationMinutes?: number
}

function normalizeSameSite(value: RawSameSite | undefined): SameSiteAttribute | undefined {
  if (typeof value === "string") {
    const normalized = value.toLowerCase()
    if (normalized === "lax") return "Lax"
    if (normalized === "strict") return "Strict"
    if (normalized === "none") return "None"
  }
  if (value === true) {
    return "Strict"
  }
  if (value === false) {
    return "Lax"
  }
  return undefined
}

export async function applySupabaseSessionCookies(
  page: Page,
  cookies: SupabaseSessionCookie[],
  baseUrl: string,
  childSession?: ChildSessionInput
): Promise<void> {
  const url = new URL(baseUrl)
  const domain = url.hostname
  const secureDefault = url.protocol === "https:"
  const now = Math.floor(Date.now() / 1000)

  await page.context().clearCookies()

  const playwrightCookies = cookies.map((cookie) => {
    const sameSite = normalizeSameSite(cookie.options?.sameSite)
    const maxAge = cookie.options?.maxAge
    return {
      name: cookie.name,
      value: cookie.value,
      domain: cookie.options?.domain ?? domain,
      path: cookie.options?.path ?? "/",
      httpOnly: cookie.options?.httpOnly ?? false,
      secure: cookie.options?.secure ?? secureDefault,
      sameSite,
      expires: typeof maxAge === "number" ? now + maxAge : undefined,
    }
  })

  if (childSession) {
    const durationMinutes = childSession.durationMinutes ?? 120
    const expiresAt = new Date(Date.now() + durationMinutes * 60_000)
    playwrightCookies.push({
      name: "child_session",
      value: JSON.stringify({
        childId: childSession.childId,
        familyId: childSession.familyId,
        displayName: childSession.displayName,
        expiresAt: expiresAt.toISOString(),
      }),
      domain,
      path: "/",
      httpOnly: true,
      secure: secureDefault,
      sameSite: "Lax",
      expires: Math.floor(expiresAt.getTime() / 1000),
    })
  }

  await page.context().addCookies(playwrightCookies)
}
