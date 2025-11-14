import { createClient } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/db/database.types"

const supabaseUrlEnv = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKeyEnv = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrlEnv) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable.")
}

export function createSupabaseServiceRoleClient(): SupabaseClient<Database, "public"> {
  if (!serviceRoleKeyEnv) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY environment variable is required to use the service client.")
  }

  const supabaseUrl = supabaseUrlEnv as string
  const serviceRoleKey = serviceRoleKeyEnv as string

  return createClient<Database, "public">(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }) as SupabaseClient<Database, "public">
}
