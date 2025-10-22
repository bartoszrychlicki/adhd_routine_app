import Link from "next/link"
import { redirect } from "next/navigation"
import { Clock, ListChecks, Sparkles } from "lucide-react"

import { ROUTINE_DEFAULTS, type RoutineType } from "@/data/routine-templates"
import { getActiveProfile } from "@/lib/auth/get-active-profile"
import { createSupabaseServerClient } from "@/lib/supabase"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RoutineSetupForm } from "./routine-setup-form"

const ROUTINE_TYPES: RoutineType[] = ["morning", "afternoon", "evening"]

type RoutineRecord = {
  id: string | null
  routineType: RoutineType
  startTime: string
  endTime: string
  autoClose: number
}

type ChildSummary = {
  id: string
  displayName: string
}

export default async function OnboardingRoutinesPage() {
  const activeProfile = await getActiveProfile()

  if (!activeProfile) {
    redirect("/auth/parent")
  }

  if (!activeProfile.familyId) {
    throw new Error("Brak przypisanej rodziny. Uzupełnij dane w poprzednim kroku.")
  }

  const supabase = await createSupabaseServerClient()

  const [{ data: routines }, { data: childProfilesData }] = await Promise.all([
    supabase
      .from("routines")
      .select("id, routine_type, start_time, end_time, auto_close_after_minutes")
      .eq("family_id", activeProfile.familyId)
      .is("deleted_at", null),
    supabase
      .from("profiles")
      .select("id, display_name")
      .eq("family_id", activeProfile.familyId)
      .eq("role", "child")
      .is("deleted_at", null),
  ])

  const childProfiles: ChildSummary[] = (childProfilesData ?? []).map((child) => ({
    id: child.id,
    displayName: child.display_name,
  }))

  const routineByType = new Map<RoutineType, RoutineRecord>()

  for (const routineType of ROUTINE_TYPES) {
    const defaults = ROUTINE_DEFAULTS[routineType]
    const matching = routines?.find((entry) => entry.routine_type === routineType)

    routineByType.set(routineType, {
      id: matching?.id ?? null,
      routineType,
      startTime: matching?.start_time?.slice(0, 5) ?? defaults.start,
      endTime: matching?.end_time?.slice(0, 5) ?? defaults.end,
      autoClose: matching?.auto_close_after_minutes ?? defaults.autoClose,
    })
  }

  return (
    <div className="flex flex-col gap-8 pb-20">
      <Card className="border-slate-800/60 bg-slate-900/40 text-slate-100 backdrop-blur">
        <CardHeader className="space-y-4">
          <Badge
            variant="outline"
            className="w-fit border-slate-700/60 bg-slate-900/60 text-xs uppercase tracking-wide text-slate-200"
          >
            Krok 2 z 3
          </Badge>
          <CardTitle className="text-2xl font-semibold">Zdefiniuj rutyny dzienne</CardTitle>
          <CardDescription className="text-sm text-slate-200/80">
            Ustal przedziały czasowe dla rutyny porannej, popołudniowej i wieczornej. Wybierz też zestaw zadań,
            które chcesz automatycznie przypisać każdemu dziecku.
          </CardDescription>
          <div className="flex flex-wrap gap-3 text-xs text-slate-300/80">
            <span className="flex items-center gap-2"><Clock className="size-4" aria-hidden />
              Godziny startu i zakończenia pozwalają obliczyć rekordy czasowe.
            </span>
            <span className="flex items-center gap-2"><Sparkles className="size-4" aria-hidden />
              Zaznaczone zadania zostaną skopiowane dla każdego dziecka.
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <RoutineSetupForm
            familyId={activeProfile.familyId}
            routines={routineByType}
            childProfiles={childProfiles}
          />
        </CardContent>
      </Card>

      <Card className="border-slate-800/60 bg-slate-900/40 text-slate-100 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Kolejny krok</CardTitle>
          <CardDescription className="text-sm text-slate-200/80">
            Gdy rutyny będą gotowe, przejdź do wyboru nagród startowych. Możesz wrócić do tego ekranu w każdej
            chwili z panelu rodzica.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 rounded-full bg-indigo-500/20 p-2 text-indigo-200">
              <ListChecks className="size-4" aria-hidden />
            </span>
            <p className="text-sm text-slate-200/80">
              Wszystkie zadania można później modyfikować w sekcji Rutyny w panelu rodzica.
            </p>
          </div>
          <Button asChild variant="outline" className="border-slate-800/60 bg-slate-900/60 text-white">
            <Link href="/onboarding/rewards">Przejdź do kroku 3</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
