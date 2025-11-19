import { Award, Gift } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { Database } from "@/db/database.types"

export type RewardLogEntry = {
  id: string
  rewardName: string
  childName: string
  status: Database["public"]["Enums"]["reward_redemption_status"]
  pointsCost: number
  requestedAt: string
}

type ParentDashboardRewardsLogProps = {
  entries: RewardLogEntry[]
}

const statusStyles: Record<
RewardLogEntry["status"],
{ label: string; className: string }
> = {
  pending: {
    label: "Oczekuje",
    className: "border-amber-500/40 bg-amber-500/10 text-amber-50"
  },
  approved: {
    label: "Zatwierdzone",
    className: "border-sky-500/40 bg-sky-500/10 text-sky-50"
  },
  fulfilled: {
    label: "Zrealizowane",
    className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-50"
  },
  rejected: {
    label: "Odrzucone",
    className: "border-rose-500/40 bg-rose-500/10 text-rose-50"
  },
  cancelled: {
    label: "Anulowane",
    className: "border-slate-600/60 bg-slate-800/60 text-slate-200"
  }
}

export function ParentDashboardRewardsLog({ entries }: ParentDashboardRewardsLogProps) {
  const hasEntries = entries.length > 0

  return (
    <Card className="border-slate-800/60 bg-slate-900/50 text-slate-100">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-white">
          <Gift className="size-5 text-purple-300" aria-hidden />
          Ostatnie nagrody
        </CardTitle>
        <CardDescription className="text-sm text-slate-300">
          Najnowsze zgłoszenia wymiany punktów przez dzieci.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasEntries ? (
          <ul className="space-y-3">
            {entries.map((entry) => {
              const style = statusStyles[entry.status as keyof typeof statusStyles] ?? statusStyles.pending
              return (
                <li
                  key={entry.id}
                  className="rounded-2xl border border-slate-800/60 bg-slate-950/30 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-white">
                    <Award className="size-4 text-purple-300" aria-hidden />
                    <span className="flex-1">{entry.rewardName}</span>
                    <Badge className={cn("text-xs", style.className)}>{style.label}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {entry.childName} · {entry.pointsCost} pkt · {formatDateTime(entry.requestedAt)}
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-800/60 bg-slate-950/30 p-6 text-sm text-slate-300">
            <p className="font-medium text-white">Brak zgłoszeń</p>
            <p className="text-slate-400">Dzieci nie zgłosiły jeszcze wymiany punktów.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function formatDateTime(date: string) {
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) {
    return date
  }

  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(parsed)
}
