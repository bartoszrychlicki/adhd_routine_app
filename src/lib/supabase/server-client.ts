import { cookies } from 'next/headers'
import { createServerClient, type CookieMethodsServer } from '@supabase/ssr'

import type { Database } from '../../../supabase/types/database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable.')
}

if (!supabaseAnonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable.')
}

export function createSupabaseServerClient() {
  const cookieStore = cookies()
  const cookieMethods: CookieMethodsServer = {
    getAll() {
      return cookieStore.getAll()
    },
  }

  const setFn = (cookieStore as unknown as { set?: (name: string, value: string) => void }).set

  if (typeof setFn === 'function') {
    cookieMethods.setAll = (cookiesToSet) => {
      cookiesToSet.forEach(({ name, value }) => {
        setFn(name, value)
      })
    }
  }

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: cookieMethods,
  })
}
