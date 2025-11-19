import { applySupabaseSessionCookies } from "../utils/auth"
import { expect, test } from "../fixtures/child"

const BASE_URL_FALLBACK = "http://127.0.0.1:3000"

test.describe("Authenticated child experience", () => {
  test("displays the home routine board with current, upcoming, and completed missions", async ({
    page,
    childSessionCookies,
    childSeedData,
    childAccountAuth,
  }, testInfo) => {
    const baseURL = testInfo.project.use?.baseURL ?? BASE_URL_FALLBACK
    await applySupabaseSessionCookies(page, childSessionCookies, baseURL, {
      childId: childAccountAuth.profileId,
      familyId: childAccountAuth.familyId,
      displayName: childAccountAuth.displayName,
    })

    await page.goto("/child/routines")

    await expect(page.getByRole("heading", { name: "Pełny harmonogram dnia" })).toBeVisible()
    await expect(page.getByText(childSeedData.routines.today.name)).toBeVisible()
    await expect(page.getByText(childSeedData.routines.upcoming.name)).toBeVisible()
    await expect(page.getByText(childSeedData.routines.completed.name)).toBeVisible()
  })

  test("lists available missions without the stats band", async ({
    page,
    childSessionCookies,
    childSeedData,
    childAccountAuth,
  }, testInfo) => {
    const baseURL = testInfo.project.use?.baseURL ?? BASE_URL_FALLBACK
    await applySupabaseSessionCookies(page, childSessionCookies, baseURL, {
      childId: childAccountAuth.profileId,
      familyId: childAccountAuth.familyId,
      displayName: childAccountAuth.displayName,
    })

    await page.goto("/child/routines")

    await expect(page.getByRole("heading", { name: "Pełny harmonogram dnia" })).toBeVisible()

    await expect(page.getByText("Dostępne dziś")).toHaveCount(0)
    await expect(page.getByText("Łączna pula punktów")).toHaveCount(0)
    await expect(page.getByText("Już ukończone")).toHaveCount(0)
    await expect(page.getByText("Aktualna seria")).toHaveCount(0)

    await expect(page.getByText(childSeedData.routines.today.name)).toBeVisible()
    await expect(page.getByText(childSeedData.routines.upcoming.name)).toBeVisible()
    await expect(page.getByText(childSeedData.routines.completed.name)).toBeVisible()
  })

  test("shows reward catalog with actionable redemption CTA", async ({
    page,
    childSessionCookies,
    childSeedData,
    childAccountAuth,
  }, testInfo) => {
    const baseURL = testInfo.project.use?.baseURL ?? BASE_URL_FALLBACK
    await applySupabaseSessionCookies(page, childSessionCookies, baseURL, {
      childId: childAccountAuth.profileId,
      familyId: childAccountAuth.familyId,
      displayName: childAccountAuth.displayName,
    })

    await page.goto("/child/rewards")

    await expect(page.getByRole("heading", { name: "Na co chcesz wymienić punkty?" })).toBeVisible()
    await expect(
      page.getByText(`Aktualne saldo: ${childSeedData.walletBalance} pkt`, { exact: false })
    ).toBeVisible()
    await expect(page.getByText(childSeedData.reward.name)).toBeVisible()
    await expect(page.getByText(`${childSeedData.reward.costPoints} pkt`)).toBeVisible()
    await expect(page.getByRole("button", { name: "Wymień punkty" })).toBeEnabled()
  })

  test("presents profile progress with achievements and recent routines", async ({
    page,
    childSessionCookies,
    childSeedData,
    childAccountAuth,
  }, testInfo) => {
    const baseURL = testInfo.project.use?.baseURL ?? BASE_URL_FALLBACK
    await applySupabaseSessionCookies(page, childSessionCookies, baseURL, {
      childId: childAccountAuth.profileId,
      familyId: childAccountAuth.familyId,
      displayName: childAccountAuth.displayName,
    })

    await page.goto("/child/profile")

    await expect(page.getByText("Tak wygląda Twoja przygoda")).toBeVisible()
    await expect(
      page.getByText(`Seria dni bez przerwy: ${childSeedData.streakDays}`, { exact: false })
    ).toBeVisible()
    await expect(page.getByText("Zdobyte odznaki")).toBeVisible()
    await expect(page.getByText(childSeedData.achievement.name)).toBeVisible()
    await expect(page.getByText("Ostatnie rutyny")).toBeVisible()
    await expect(page.getByText(childSeedData.routines.completed.name)).toBeVisible()
  })
})
