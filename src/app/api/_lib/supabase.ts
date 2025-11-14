import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/db/database.types"
import { HttpError } from "./errors"

type TypedClient = SupabaseClient<Database>

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY

function getSupabaseKey(): string {
  if (SUPABASE_SERVICE_ROLE_KEY) {
    return SUPABASE_SERVICE_ROLE_KEY
  }

  if (SUPABASE_ANON_KEY) {
    return SUPABASE_ANON_KEY
  }

  throw new HttpError(
    500,
    "supabase_config_error",
    "Supabase key is not configured"
  )
}

export function createSupabaseClient(): TypedClient {
  if (!SUPABASE_URL) {
    throw new HttpError(
      500,
      "supabase_config_error",
      "Supabase URL is not configured"
    )
  }

  return createClient<Database>(SUPABASE_URL, getSupabaseKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  })
}
