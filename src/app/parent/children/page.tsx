import Link from "next/link"
import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { QrCode } from "lucide-react"

import { createSupabaseServerClient } from "@/lib/supabase"
import { getActiveProfile } from "@/lib/auth/get-active-profile"
import { getAppBaseUrl } from "@/lib/env"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ChildTokenCopyButton } from "@/components/parent/ChildTokenCopyButton"
import { ChildPinManager } from "@/components/parent/ChildPinManager"

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleString("pl-PL")
}

export const metadata: Metadata = {
  title: "Profile dzieci",
  description: "Udostępnij link logowania i zarządzaj PIN-em każdego dziecka.",
}

export default async function ParentChildrenPage() {
  const activeProfile = await getActiveProfile()
  if (!activeProfile) {
    redirect("/auth/parent")
  }

  if (!activeProfile.familyId) {
    throw new Error("Brak przypisanej rodziny.")
  }

  const supabase = await createSupabaseServerClient()
  const appBaseUrl = getAppBaseUrl()

  const { data: children } = await supabase
    .from("profiles")
    .select("id, display_name, last_login_at, settings")
    .eq("family_id", activeProfile.familyId)
    .eq("role", "child")
    .is("deleted_at", null)
    .order("display_name", { ascending: true })

  return (
    <div className="flex flex-col gap-6 pb-12">
      <Card className="border-slate-800/60 bg-slate-900/40 text-slate-100">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-2xl font-semibold">Profile dzieci</CardTitle>
            <CardDescription className="text-sm text-slate-200/80">
              Zarządzaj dostępem dzieci do aplikacji. Udostępnij link logowania i aktualny PIN, aby dziecko mogło wejść do swoich rutyn.
            </CardDescription>
          </div>
          <Button asChild variant="outline" className="border-slate-800/60 bg-slate-900/50 text-white">
            <Link href="/onboarding/family">Dodaj nowe dziecko</Link>
          </Button>
        </CardHeader>
      </Card>

      {children?.length === 0 ? (
        <Alert className="border-slate-800/60 bg-slate-900/40 text-slate-200/80">
          <AlertTitle>Brak dzieci w rodzinie</AlertTitle>
          <AlertDescription>Dodaj profil dziecka w kroku onboardingowym, aby zarządzać dostępem.</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4">
        {children?.map((child) => {
          const settings = (child.settings as Record<string, unknown> | null) ?? null
          const storedPin = (() => {
            if (!settings) return null
            const raw = settings["pin_plain"]
            return typeof raw === "string" ? raw : null
          })()
          const loginLink = `${appBaseUrl}/auth/child?childId=${child.id}`

          return (
            <Card key={child.id} className="border-slate-800/60 bg-slate-900/40 text-slate-100">
              <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg font-semibold">{child.display_name}</CardTitle>
                  <CardDescription className="text-sm text-slate-200/80">
                    Ostatnie logowanie: {formatDate(child.last_login_at)}
                  </CardDescription>
                </div>
                <Badge variant="outline" className="border-teal-500/40 text-teal-200">
                  Link logowania aktywny
                </Badge>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                  <div className="flex flex-col gap-3">
                    <ChildTokenCopyButton loginLink={loginLink} />

                    <ChildPinManager childId={child.id} currentPin={storedPin} />

                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="secondary">
                        <Link href={`/parent/children/${child.id}/preview`}>Wejdź jako dziecko</Link>
                      </Button>
                    </div>
                  </div>
                  <div className="flex h-32 w-32 items-center justify-center rounded-xl border border-slate-800/60 bg-slate-900/50 text-xs text-slate-400">
                    <QrCode className="size-8" aria-hidden />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
