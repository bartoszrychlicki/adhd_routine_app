import type { Metadata } from "next"

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChildRoutineTabs } from "./components/ChildRoutineTabs"
import { buildChildRoutineTabsModel } from "./tab-model"
import { fetchChildRoutineBoard, fetchChildRoutineSessionViewModelForChild } from "@/lib/child/queries"
import type { ChildRoutineSessionViewModel } from "@/lib/child/types"
import { createSupabaseServiceRoleClient } from "@/lib/supabase"
import { requireChildSession } from "@/lib/auth/child-session"
import { listRoutinePerformance } from "@/app/api/_services/performanceService"

function getCurrentDateInTimezone(timezone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  return formatter.format(new Date())
}

export const metadata: Metadata = {
  title: "Lista rutyn",
  description: "Przeglądaj dostępne, nadchodzące i ukończone rutyny dnia.",
}
export default async function ChildRoutinesPage() {
  const session = await requireChildSession()
  const supabase = createSupabaseServiceRoleClient()
  const board = await fetchChildRoutineBoard(supabase, session.childId)

  const { data: timezoneRow } = await supabase
    .from("profiles")
    .select("families(timezone)")
    .eq("id", session.childId)
    .maybeSingle<{ families: { timezone: string | null } | null }>()

  const timezone = timezoneRow?.families?.timezone ?? "Europe/Warsaw"

  const sessionIds = [
    ...board.today,
    ...board.upcoming,
    ...board.completed,
  ].map((preview) => preview.sessionId)

  const uniqueSessionIds = Array.from(new Set(sessionIds))

  const routineSessions = await Promise.all(
    uniqueSessionIds.map(async (sessionId) => {
      const details = await fetchChildRoutineSessionViewModelForChild(supabase, sessionId, session.childId)
      return details
    })
  )

  const sessionsWithData = routineSessions.filter(Boolean) as ChildRoutineSessionViewModel[]
  const performanceStats = await listRoutinePerformance(supabase, session.childId)
  const { tabs } = buildChildRoutineTabsModel({
    board,
    sessions: sessionsWithData,
    timezone,
    performanceStats: performanceStats.data,
  })

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-violet-200/70">Twoje rutyny</p>
        <h2 className="text-2xl font-semibold text-white">Pełny harmonogram dnia</h2>
        <p className="text-sm text-violet-100/80">
          Sprawdź, które misje są dostępne teraz, które rozpoczną się wkrótce i co już udało się ukończyć.
        </p>
      </header>

      <section className="space-y-4">
        {tabs.length === 0 ? (
          <Card className="border-slate-800/60 bg-slate-900/40 text-slate-200/80">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-white">Brak zaplanowanych rutyn</CardTitle>
              <CardDescription className="text-sm">
                Poproś rodzica o skonfigurowanie rutyn w panelu administracyjnym.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <ChildRoutineTabs tabs={tabs} childId={session.childId} familyId={session.familyId} />
        )}
      </section>
    </div>
  )
}
