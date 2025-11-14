import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/db/database.types"

const supabaseUrlEnv = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKeyEnv = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrlEnv) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable.')
}

if (!supabaseAnonKeyEnv) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable.')
}

export function createSupabaseBrowserClient(): SupabaseClient<Database, "public"> {
  return createBrowserClient<Database, "public">(
    supabaseUrlEnv as string,
    supabaseAnonKeyEnv as string
  ) as SupabaseClient<Database, "public">
}
