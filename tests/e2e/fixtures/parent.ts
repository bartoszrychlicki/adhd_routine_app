import { test as base } from "@playwright/test"

import {
  createChildProfileForFamily,
  createParentAccount,
  deleteParentAccount,
  getMissingSupabaseAdminEnv,
  type ChildProfileFixture,
  type ParentAccountFixture,
} from "../utils/supabase-admin"

export const test = base.extend<{
  parentAccount: ParentAccountFixture
  childProfile: ChildProfileFixture
}>({
  parentAccount: [
    async ({}, use, testInfo) => {
      const missing = getMissingSupabaseAdminEnv()
      if (missing.length > 0) {
        testInfo.skip(
          true,
          `Pominięto scenariusz wymagający Supabase. Ustaw zmienne środowiskowe: ${missing.join(", ")}`
        )
      }

      const account = await createParentAccount()

      try {
        await use(account)
      } finally {
        await deleteParentAccount(account)
      }
    },
    { scope: "test" },
  ],
  childProfile: [
    async ({ parentAccount }, use) => {
      const child = await createChildProfileForFamily(parentAccount.familyId)
      await use(child)
    },
    { scope: "test" },
  ],
})

export const expect = test.expect
