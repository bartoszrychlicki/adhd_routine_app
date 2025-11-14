import { expect, test } from "@playwright/test"

import {
  createParentAccount,
  deleteParentAccount,
  ensureRewardForFamily,
  ensureRoutineSessionWindow,
  getMissingSupabaseAdminEnv,
  listChildProfilesForFamily,
} from "./utils/supabase-admin"

type ChildProfileSummary = {
  id: string
  displayName: string
  pin: string | null
}

const BASE_URL_FALLBACK = "http://127.0.0.1:3000"

test.describe("Core product journey", () => {
  test("parent onboarding through child routine and rewards", async ({ page, browser }, testInfo) => {
    const missing = getMissingSupabaseAdminEnv()
    if (missing.length > 0) {
      test.skip(
        true,
        `Pominięto scenariusz wymagający Supabase. Ustaw zmienne środowiskowe: ${missing.join(", ")}`
      )
    }

    const parentAccount = await createParentAccount()
    const childName = `Eryk ${crypto.randomUUID().slice(0, 4)}`
    const childPin = "2580"
    const baseURL =
      (testInfo.project.use?.baseURL as string | undefined) ?? BASE_URL_FALLBACK

    let childProfile: ChildProfileSummary | null = null

    try {
      // 1. Parent login
      await page.goto("/auth/parent")
      await page.getByLabel("Adres email").fill(parentAccount.email)
      await page.getByLabel("Hasło").fill(parentAccount.password)
      await page.getByRole("button", { name: "Zaloguj się" }).click()
      await page.waitForURL(/parent\/dashboard/, { timeout: 15_000 })

      // 2. Add child via onboarding
      await page.goto("/onboarding/family")
      await page.locator("#displayName").fill(childName)
      await page.locator("#pin").fill(childPin)
      await page.getByRole("button", { name: "Dodaj dziecko" }).click()
      await expect(page.getByText(/Dodano dziecko/i)).toBeVisible()

      await expect
        .poll(async () => {
          const profiles = await listChildProfilesForFamily(parentAccount.familyId)
          childProfile =
            profiles.find((profile) => profile.displayName === childName) ?? null
          return childProfile
        })
        .not.toBeNull()

      if (!childProfile) {
        throw new Error("Child profile not created via onboarding")
      }

      const resolvedChildProfile = childProfile as ChildProfileSummary

      expect.soft(resolvedChildProfile.pin).toBe(childPin)

      // 3. Save routines via onboarding
      await page.goto("/onboarding/routines")
      await page.getByRole("button", { name: "Zapisz rutyny" }).click()
      await expect(page.getByText("Rutyny zostały zaktualizowane.")).toBeVisible()

      // Prepare routine window and reward data
      await ensureRoutineSessionWindow({
        familyId: parentAccount.familyId,
        childProfileId: resolvedChildProfile.id,
        routineType: "morning",
      })
      await ensureRewardForFamily(parentAccount.familyId, {
        name: "Seans Playwrighta",
        costPoints: 30,
      })

      // 4. Child login and routine completion
      const childContext = await browser.newContext({ baseURL })
      const childPage = await childContext.newPage()

      await childPage.goto(`/auth/child?childId=${resolvedChildProfile.id}`)
      await childPage.getByLabel("PIN logowania").fill(childPin)
      await childPage.getByRole("button", { name: "Wejdź do rutyn" }).click()
      await childPage.waitForURL(/child\/home/)
      const childCookies = await childPage.context().cookies()
      const childSessionCookie = childCookies.find((cookie) => cookie.name === "child_session")
      expect.soft(childSessionCookie, "child session cookie missing after login").toBeTruthy()
      await childPage.goto("/child/routines")

      const startButton = childPage.getByRole("button", { name: "Start" })
      await expect(startButton).toBeVisible()
      const startHelper = childPage.getByText("Uruchom timer, aby rozpocząć misję.")
      const startResponsePromise = childPage.waitForResponse((response) => {
        return response.url().includes(`/api/v1/children/${resolvedChildProfile.id}/sessions`) && response.request().method() === "POST"
      })
      await startButton.click()
      const startResponse = await startResponsePromise
      if (!startResponse.ok()) {
        const payload = await startResponse.text()
        console.error("Failed to start child routine session", startResponse.status(), payload)
      }
      expect.soft(startResponse.ok(), "child routine start request failed").toBeTruthy()
      await expect(startHelper).toBeHidden()

      const taskButtons = childPage.getByRole("button", { name: "Zrobione" })
      while ((await taskButtons.count()) > 0) {
        await expect(taskButtons.first()).toBeEnabled({ timeout: 15_000 })
        await taskButtons.first().click()
      }

      const finishButton = childPage.getByRole("button", { name: /Zakończ rutynę/i })
      await expect(finishButton).toBeEnabled({ timeout: 15_000 })
      await finishButton.click()
      await childPage.waitForURL(/child\/routines\/.+\/success/)

      const timeCard = childPage.locator("section").filter({ hasText: "Czas rutyny" })
      await expect(timeCard).toContainText(":")

      // 5. Rewards catalog visibility
      await childPage.goto("/child/rewards")
      await expect(childPage.getByText("Sklep nagród")).toBeVisible()
      await expect(childPage.getByText("Seans Playwrighta")).toBeVisible()
      await childPage.close()
      await childContext.close()
    } finally {
      await deleteParentAccount(parentAccount)
    }
  })
})
