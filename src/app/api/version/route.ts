import { NextResponse } from "next/server"

export async function GET(): Promise<Response> {
  return NextResponse.json(
    {
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? "dev",
      commit: process.env.NEXT_PUBLIC_GIT_COMMIT ?? "unknown",
      supabaseSchemaVersion: process.env.NEXT_PUBLIC_SUPABASE_SCHEMA ?? "unknown"
    },
    { status: 200 }
  )
}
