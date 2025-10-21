import { NextResponse } from "next/server"

export async function GET(): Promise<Response> {
  return NextResponse.json(
    {
      status: "ok",
      timestamp: new Date().toISOString()
    },
    { status: 200 }
  )
}
