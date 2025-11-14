import Link from "next/link"
import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { ArrowRight, CalendarClock, CheckCircle2, LayoutDashboard } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createSupabaseServerClient } from "@/lib/supabase"
import { getActiveProfile } from "@/lib/auth/get-active-profile"

type FamilySettings = {
  onboarding?: {
    completedSteps?: string[]
    isComplete?: boolean
  }
}

export const metadata: Metadata = {
  title: "Panel rodzica",
  description: "Przegląd statusu rutyn, konfiguracji i postępów w rodzinie.",
}

export default async function ParentDashboardPage() {
  const activeProfile = await getActiveProfile()

  if (!activeProfile) {
    redirect("/auth/parent")
  }

  if (activeProfile.role === "child") {
    redirect("/child/routines")
  }

  if (!activeProfile.familyId) {
    redirect("/onboarding/family")
  }

  const supabase = await createSupabaseServerClient()

  const { data: family, error } = await supabase
    .from("families")
    .select("id, family_name, settings")
    .eq("id", activeProfile.familyId)
    .maybeSingle()

  if (error || !family) {
    return (
      <Card className="border-red-500/40 bg-red-500/10 text-red-100">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-red-100">Nie udało się załadować danych rodziny</CardTitle>
          <CardDescription className="text-sm text-red-200/80">
            Spróbuj odświeżyć stronę lub przejdź do konfiguracji rodziny.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button asChild variant="ghost" className="border border-red-500/40 bg-red-500/20 text-red-100">
            <Link href="/onboarding/family">Przejdź do konfiguracji</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const settings = (family.settings as FamilySettings | null) ?? {}
  const onboardingDone = settings.onboarding?.isComplete ?? false

  return (
    <div className="grid gap-6">
      {!onboardingDone ? (
        <Card className="border-amber-500/40 bg-amber-500/10 text-amber-100">
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-amber-500/50 bg-amber-500/20 text-xs text-amber-50">
                Uwaga
              </Badge>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold text-amber-50">
                <CalendarClock className="size-4" aria-hidden />
                Dokończ onboarding, aby odblokować panel
              </CardTitle>
            </div>
            <CardDescription className="text-sm text-amber-100/80">
              Wygląda na to, że nie wszystkie kroki zostały zakończone. Przejdź do konfiguracji, aby uzupełnić brakujące
              dane rutyn i nagród.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="lg" className="bg-amber-500 text-amber-950 hover:bg-amber-400">
              <Link href="/onboarding/family">
                Dokończ konfigurację
                <ArrowRight className="ml-2 size-4" aria-hidden />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 rounded-3xl border border-slate-800/60 bg-slate-900/40 p-6 backdrop-blur lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
            <LayoutDashboard className="size-5 text-teal-300" aria-hidden />
            Podsumowanie (w przygotowaniu)
          </h2>
          <p className="text-sm text-slate-200/80">
            Dashboard jeszcze powstaje. Po zakończeniu implementacji zobaczysz tu dzienne statystyki rutyn, postęp
            punktów i rekomendacje nagród.
          </p>
          <div className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-4 text-sm text-slate-200/80">
            <p className="font-medium text-white">Co będzie dostępne?</p>
            <ul className="mt-2 space-y-2">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-teal-300" aria-hidden />
                Status rutyn „dziś” i „wczoraj”
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-teal-300" aria-hidden />
                Czas wykonania i pobite rekordy
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-teal-300" aria-hidden />
                Szybkie skróty do zadań i nagród
              </li>
            </ul>
          </div>
        </div>
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-800/60 bg-slate-950/40 p-5 text-sm text-slate-200/80">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-300/70">Nazwa rodziny</p>
            <p className="text-lg font-semibold text-white">{family.family_name ?? "Twoja rodzina"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-300/70">Stan konfiguracji</p>
            <p className="text-base font-medium text-white">
              {onboardingDone ? "Onboarding zakończony" : "Onboarding w toku"}
            </p>
          </div>
          <div className="mt-auto flex flex-col gap-2">
            <Button asChild variant="outline" className="w-full border-slate-800/60 bg-slate-900/60 text-white">
              <Link href={onboardingDone ? "/parent/rewards" : "/onboarding/rewards"}>
                {onboardingDone ? "Zobacz nagrody" : "Skonfiguruj nagrody"}
              </Link>
            </Button>
            <Button asChild className="w-full">
              <Link href={onboardingDone ? "/parent/routines" : "/onboarding/routines"}>
                {onboardingDone ? "Zarządzaj rutynami" : "Przejdź do kreatora rutyn"}
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
