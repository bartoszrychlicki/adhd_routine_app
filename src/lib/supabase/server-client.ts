import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/db/database.types"

const supabaseUrlEnv = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKeyEnv = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrlEnv) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable.")
}

if (!supabaseAnonKeyEnv) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable.")
}

type ServerClientOptions = {
  allowCookiePersistence?: boolean
}

export async function createSupabaseServerClient(
  options: ServerClientOptions = {}
): Promise<SupabaseClient<Database, "public">> {
  const supabaseUrl = supabaseUrlEnv as string
  const supabaseAnonKey = supabaseAnonKeyEnv as string
  async function getCookieStore() {
    return cookies()
  }

  const allowWrites = options.allowCookiePersistence === true

  return createServerClient<Database, "public">(supabaseUrl, supabaseAnonKey, {
    cookies: {
      async get(name) {
        return (await getCookieStore()).get(name)?.value
      },
      async set(name, value, cookieOptions) {
        if (!allowWrites) {
          return
        }

        const store = await getCookieStore()
        store.set({ name, value, ...cookieOptions })
      },
      async remove(name, cookieOptions) {
        if (!allowWrites) {
          return
        }

        const store = await getCookieStore()
        store.delete({ name, ...cookieOptions })
      },
    },
  }) as SupabaseClient<Database, "public">
}
