import { applySupabaseSessionCookies } from "../utils/auth"
import { updateRoutineWindow } from "../utils/supabase-admin"
import { expect, test } from "../fixtures/child"

const BASE_URL_FALLBACK = "http://127.0.0.1:3000"
const TIMEZONE = "Europe/Warsaw"

function formatDbTime(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)

  const pick = (type: Intl.DateTimeFormatPartTypes, fallback: string) =>
    parts.find((part) => part.type === type)?.value ?? fallback

  return `${pick("hour", "00")}:${pick("minute", "00")}:${pick("second", "00")}`
}

function formatLabelTime(date: Date): string {
  return new Intl.DateTimeFormat("pl-PL", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date)
}

test.describe("Child routine availability windows", () => {
  test("marks routine as active within its availability window", async ({
    page,
    childSessionCookies,
    childSeedData,
    childAccountAuth,
  }, testInfo) => {
    const now = new Date()
    const start = new Date(now.getTime() - 5 * 60 * 1000)
    const end = new Date(now.getTime() + 10 * 60 * 1000)

    await updateRoutineWindow(childSeedData.routines.today.sessionId, {
      startTime: formatDbTime(start),
      endTime: formatDbTime(end),
    })

    const baseURL = testInfo.project.use?.baseURL ?? BASE_URL_FALLBACK
    await applySupabaseSessionCookies(page, childSessionCookies, baseURL, {
      childId: childAccountAuth.profileId,
      familyId: childAccountAuth.familyId,
      displayName: childAccountAuth.displayName,
    })

    await page.goto("/child/routines")

    const routineTab = page.getByRole("tab", {
      name: new RegExp(`${childSeedData.routines.today.name}`),
    })
    await expect(routineTab).toContainText("Dostępna teraz")

    const inactiveMessage = page.getByText("Ta rutyna jest teraz nieaktywna", { exact: false })
    await expect(inactiveMessage).toHaveCount(0)
  })

  test("shows upcoming message before window start", async ({
    page,
    childSessionCookies,
    childSeedData,
    childAccountAuth,
  }, testInfo) => {
    const now = new Date()
    const start = new Date(now.getTime() + 60 * 60 * 1000)
    const end = new Date(start.getTime() + 30 * 60 * 1000)
    const startLabel = formatLabelTime(start)

    await updateRoutineWindow(childSeedData.routines.today.sessionId, {
      startTime: formatDbTime(start),
      endTime: formatDbTime(end),
    })

    const baseURL = testInfo.project.use?.baseURL ?? BASE_URL_FALLBACK
    await applySupabaseSessionCookies(page, childSessionCookies, baseURL, {
      childId: childAccountAuth.profileId,
      familyId: childAccountAuth.familyId,
      displayName: childAccountAuth.displayName,
    })

    await page.goto("/child/routines")

    const routineTab = page.getByRole("tab", {
      name: new RegExp(`${childSeedData.routines.today.name}`),
    })
    await expect(routineTab).toContainText(`Wkrótce ${startLabel}`)
    await expect(
      page.getByText(`Ta rutyna jest teraz nieaktywna. Będzie dostępna o ${startLabel}.`, { exact: true })
    ).toBeVisible()
    await expect(page.getByRole("button", { name: /Zakończ rutynę/i })).toHaveCount(0)
  })

  test("shows completed window messaging after end time", async ({
    page,
    childSessionCookies,
    childSeedData,
    childAccountAuth,
  }, testInfo) => {
    const now = new Date()
    const start = new Date(now.getTime() - 120 * 60 * 1000)
    const end = new Date(now.getTime() - 60 * 60 * 1000)
    const endLabel = formatLabelTime(end)

    await updateRoutineWindow(childSeedData.routines.today.sessionId, {
      startTime: formatDbTime(start),
      endTime: formatDbTime(end),
    })

    const baseURL = testInfo.project.use?.baseURL ?? BASE_URL_FALLBACK
    await applySupabaseSessionCookies(page, childSessionCookies, baseURL, {
      childId: childAccountAuth.profileId,
      familyId: childAccountAuth.familyId,
      displayName: childAccountAuth.displayName,
    })

    await page.goto("/child/routines")

    await expect(
      page.getByText(`Ta rutyna była dostępna do ${endLabel}.`, { exact: false })
    ).toBeVisible()
    await expect(page.getByRole("button", { name: /Zakończ rutynę/i })).toHaveCount(0)
  })
})
