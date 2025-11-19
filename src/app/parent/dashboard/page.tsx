import Link from "next/link"
import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { ArrowRight, CalendarClock, LayoutDashboard } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createSupabaseServerClient } from "@/lib/supabase"
import { getActiveProfile } from "@/lib/auth/get-active-profile"
import type { Database } from "@/db/database.types"
import {
  ParentDashboardDatePicker
} from "@/components/parent/dashboard/ParentDashboardDatePicker"
import {
  ParentDashboardKpiCards
} from "@/components/parent/dashboard/ParentDashboardKpiCards"
import {
  ParentDashboardProgressCard
} from "@/components/parent/dashboard/ParentDashboardProgressCard"
import {
  ParentDashboardRewardsLog,
  type RewardLogEntry
} from "@/components/parent/dashboard/ParentDashboardRewardsLog"
import {
  buildDashboardKpis,
  clampIsoDate,
  formatPolishDate
} from "@/lib/parent/dashboard"
import { getDailyFamilyProgress } from "@/app/api/_services/familyProgressService"
import type { AppSupabaseClient } from "@/app/api/_lib/types"
import type { FamilyProgressSummaryDto } from "@/types"

type FamilySettings = {
  onboarding?: {
    completedSteps?: string[]
    isComplete?: boolean
  }
}

type SearchParamsInput = {
  date?: string | string[]
}

type ParentDashboardPageProps = {
  searchParams?: SearchParamsInput | Promise<SearchParamsInput>
}

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"]
type ChildProfileSummary = Pick<
ProfileRow,
"id" | "display_name" | "role" | "deleted_at"
>
type RewardRedemptionRow = Database["public"]["Tables"]["reward_redemptions"]["Row"] & {
  reward: { name: string } | null
  child: { display_name: string } | null
}

export const metadata: Metadata = {
  title: "Panel rodzica",
  description: "Przegląd statusu rutyn, konfiguracji i postępów w rodzinie."
}

export default async function ParentDashboardPage({ searchParams }: ParentDashboardPageProps) {
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

  const resolvedSearchParams = await resolveSearchParams(searchParams)
  const requestedDate = Array.isArray(resolvedSearchParams?.date)
    ? resolvedSearchParams?.date[0]
    : resolvedSearchParams?.date

  const { todayIso, minDateIso } = getDateBoundaries()
  const selectedDate = clampIsoDate(requestedDate, minDateIso, todayIso)
  const previousDateIso = subtractIsoDays(selectedDate, 1)
  const hasPreviousWindow = compareIsoDates(previousDateIso, minDateIso) >= 0

  const [familyResult, childProfilesResult] = await Promise.all([
    supabase
      .from("families")
      .select("id, family_name, settings")
      .eq("id", activeProfile.familyId)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("id, display_name, role, deleted_at")
      .eq("family_id", activeProfile.familyId)
      .eq("role", "child")
      .is("deleted_at", null)
  ])

  if (familyResult.error || !familyResult.data) {
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

  if (childProfilesResult.error) {
    console.error("[parent-dashboard] failed to load children profiles", childProfilesResult.error)
  }

  const childProfiles: ChildProfileSummary[] = childProfilesResult.data ?? []
  const childNameMap: Record<string, string> = Object.fromEntries(
    childProfiles.map((child) => [child.id, child.display_name])
  )

  const settings = (familyResult.data.settings as FamilySettings | null) ?? {}
  const onboardingDone = settings.onboarding?.isComplete ?? false

  const [selectedSummary, previousSummary] = await loadProgressSummaries(
    supabase,
    activeProfile.familyId,
    selectedDate,
    hasPreviousWindow ? previousDateIso : undefined
  )

  const kpis = buildDashboardKpis(selectedSummary)

  const rewardEntries = await loadRewardEntries(
    supabase,
    childProfiles.map((child) => child.id)
  )

  const selectedHeading = selectedDate === todayIso ? "Dziś" : "Wybrany dzień"
  const previousHeading = selectedDate === todayIso ? "Wczoraj" : "Poprzedni dzień"

  const selectedBadge = selectedDate === todayIso ? "Dziś" : undefined
  const yesterdayIso = subtractIsoDays(todayIso, 1)
  const previousBadge =
    selectedDate === todayIso
      ? "Wczoraj"
      : selectedDate === yesterdayIso
        ? "Wczoraj"
        : undefined

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

      <section className="rounded-3xl border border-slate-800/60 bg-slate-900/40 p-6 backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="flex-1 space-y-1">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
              <LayoutDashboard className="size-5 text-teal-300" aria-hidden />
              Postęp rodziny
            </h2>
            <p className="text-sm text-slate-300">
              {selectedSummary
                ? `Wybrany dzień: ${formatPolishDate(selectedSummary.date)}`
                : `Brak danych dla ${formatPolishDate(selectedDate)}`}
            </p>
          </div>
          <ParentDashboardDatePicker value={selectedDate} min={minDateIso} max={todayIso} />
        </div>
        <div className="mt-6">
          <ParentDashboardKpiCards kpis={kpis} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ParentDashboardProgressCard
          summary={selectedSummary}
          heading={selectedHeading}
          dateLabel={selectedSummary?.date ?? selectedDate}
          badge={selectedBadge}
          childNames={childNameMap}
        />
        <ParentDashboardProgressCard
          summary={previousSummary}
          heading={previousHeading}
          dateLabel={hasPreviousWindow ? previousSummary?.date ?? previousDateIso : undefined}
          badge={previousBadge}
          childNames={childNameMap}
          isFallback={!hasPreviousWindow}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ParentDashboardRewardsLog entries={rewardEntries} />
        <Card className="border-slate-800/60 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-white">Szybkie akcje</CardTitle>
            <CardDescription className="text-sm text-slate-300">
              Zarządzaj konfiguracją rodziny i przejdź do najczęściej używanych ekranów.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Nazwa rodziny</p>
              <p className="text-lg font-semibold text-white">
                {familyResult.data.family_name ?? "Twoja rodzina"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Stan konfiguracji</p>
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
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

async function resolveSearchParams(
  input?: SearchParamsInput | Promise<SearchParamsInput>
): Promise<SearchParamsInput | undefined> {
  if (!input) {
    return undefined
  }

  if (isPromise<SearchParamsInput>(input)) {
    return input
  }

  return input
}

function isPromise<T>(value: unknown): value is Promise<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof (value as { then?: unknown }).then === "function"
  )
}

async function loadProgressSummaries(
  supabase: AppSupabaseClient,
  familyId: string,
  selectedDate: string,
  previousDate?: string
): Promise<readonly [FamilyProgressSummaryDto | null, FamilyProgressSummaryDto | null]> {
  try {
    const selectedPromise = getDailyFamilyProgress(supabase, familyId, selectedDate)
    const previousPromise = previousDate
      ? getDailyFamilyProgress(supabase, familyId, previousDate)
      : Promise.resolve(null)

    const [selectedSummary, previousSummary] = await Promise.all([
      selectedPromise,
      previousPromise
    ])

    return [selectedSummary, previousSummary] as const
  } catch (error) {
    console.error("[parent-dashboard] failed to load progress", error)
    return [null, null] as const
  }
}

async function loadRewardEntries(
  supabase: AppSupabaseClient,
  childProfileIds: string[]
): Promise<RewardLogEntry[]> {
  if (childProfileIds.length === 0) {
    return []
  }

  const { data, error } = await supabase
    .from("reward_redemptions")
    .select(
      "id, points_cost, status, requested_at, reward:rewards(name), child:profiles!reward_redemptions_child_profile_id_fkey(display_name)"
    )
    .in("child_profile_id", childProfileIds)
    .order("requested_at", { ascending: false })
    .limit(5)

  if (error) {
    console.error("[parent-dashboard] failed to load rewards log", error)
    return []
  }

  return (data as RewardRedemptionRow[]).map((entry) => ({
    id: entry.id,
    rewardName: entry.reward?.name ?? "Nagroda",
    childName: entry.child?.display_name ?? "Dziecko",
    status: entry.status,
    pointsCost: entry.points_cost,
    requestedAt: entry.requested_at
  }))
}

function getDateBoundaries() {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const minDate = new Date(today)
  minDate.setUTCDate(minDate.getUTCDate() - 30)

  return {
    todayIso: today.toISOString().slice(0, 10),
    minDateIso: minDate.toISOString().slice(0, 10)
  }
}

function subtractIsoDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString().slice(0, 10)
}

function compareIsoDates(a: string, b: string) {
  const first = new Date(`${a}T00:00:00Z`).getTime()
  const second = new Date(`${b}T00:00:00Z`).getTime()
  return first - second
}
