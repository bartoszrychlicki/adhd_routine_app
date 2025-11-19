import { CheckCircle2, Clock3, Target } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import type { DashboardKpis } from "@/lib/parent/dashboard"

type ParentDashboardKpiCardsProps = {
  kpis: DashboardKpis
}

const KPI_META = [
  {
    key: "completion",
    label: "Skuteczność rutyn",
    description: "Ukończone sesje dzieci",
    icon: CheckCircle2
  },
  {
    key: "duration",
    label: "Średni czas wykonywania",
    description: "Średnia per dziecko",
    icon: Clock3
  },
  {
    key: "tasks",
    label: "Ukończone zadania",
    description: "Postęp w zadaniach cząstkowych",
    icon: Target
  }
] as const

export function ParentDashboardKpiCards({ kpis }: ParentDashboardKpiCardsProps) {
  const completionValue =
    kpis.totalSessions > 0
      ? `${kpis.completedSessions}/${kpis.totalSessions} (${kpis.completionRate}%)`
      : "Brak danych"

  const durationValue = kpis.averageDurationMinutes ? `${kpis.averageDurationMinutes} min` : "—"

  const tasksValue =
    kpis.totalTasks > 0 ? `${kpis.completedTasks}/${kpis.totalTasks}` : "Brak zadań"

  const valueMap = {
    completion: completionValue,
    duration: durationValue,
    tasks: tasksValue
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {KPI_META.map((item) => {
        const Icon = item.icon
        return (
          <Card
            key={item.key}
            className="border-slate-800/60 bg-slate-950/40 text-slate-200 backdrop-blur-sm"
          >
            <CardContent className="flex flex-col gap-2 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-100">
                <Icon className="size-4 text-teal-300" aria-hidden />
                {item.label}
              </div>
              <p className="text-2xl font-semibold text-white">{valueMap[item.key]}</p>
              <p className="text-xs text-slate-400">{item.description}</p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
