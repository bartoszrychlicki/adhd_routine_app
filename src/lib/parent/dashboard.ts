import type {
  FamilyProgressChildSummaryDto,
  FamilyProgressRoutineSummaryDto,
  FamilyProgressSummaryDto
} from "@/types"

export type DashboardKpis = {
  totalRoutines: number
  totalSessions: number
  completedSessions: number
  completionRate: number
  averageDurationMinutes: number | null
  totalTasks: number
  completedTasks: number
}

const defaultKpis: DashboardKpis = {
  totalRoutines: 0,
  totalSessions: 0,
  completedSessions: 0,
  completionRate: 0,
  averageDurationMinutes: null,
  totalTasks: 0,
  completedTasks: 0
}

export function buildDashboardKpis(
  summary?: FamilyProgressSummaryDto | null
): DashboardKpis {
  if (!summary) {
    return defaultKpis
  }

  const totalRoutines = summary.routines.length
  let totalSessions = 0
  let completedSessions = 0
  let totalTasks = 0
  let completedTasks = 0
  const durations: number[] = []

  summary.routines.forEach((routine) => {
    routine.children.forEach((child) => {
      totalSessions += 1

      if (child.status === "completed") {
        completedSessions += 1
      }

      if (child.durationSeconds) {
        durations.push(child.durationSeconds)
      }

      const tasks = child.tasks ?? []
      totalTasks += tasks.length
      completedTasks += tasks.filter((task) => task.status === "completed").length
    })
  })

  const completionRate =
    totalSessions > 0
      ? Math.round((completedSessions / totalSessions) * 100)
      : 0

  const averageDurationMinutes =
    durations.length > 0
      ? Math.round(
        durations.reduce((sum, value) => sum + value, 0) /
            durations.length /
            60
      )
      : null

  return {
    totalRoutines,
    totalSessions,
    completedSessions,
    completionRate,
    averageDurationMinutes,
    totalTasks,
    completedTasks
  }
}

export function formatDuration(seconds?: number | null): string | undefined {
  if (!seconds || seconds <= 0) {
    return undefined
  }

  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60

  if (minutes && remainder) {
    return `${minutes} min ${remainder}s`
  }

  if (minutes) {
    return `${minutes} min`
  }

  return `${remainder}s`
}

export function clampIsoDate(
  value: string | null | undefined,
  min: string,
  max: string
): string {
  const fallback = max

  if (!value) {
    return fallback
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return fallback
  }

  const parsedValue = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsedValue.getTime())) {
    return fallback
  }

  const minDate = new Date(`${min}T00:00:00Z`)
  const maxDate = new Date(`${max}T00:00:00Z`)

  if (parsedValue.getTime() > maxDate.getTime()) {
    return fallback
  }

  if (parsedValue.getTime() < minDate.getTime()) {
    return min
  }

  return value
}

type SessionStatus = FamilyProgressChildSummaryDto["status"]

export const SESSION_STATUS_META: Record<
SessionStatus,
{ label: string; badgeClass: string }
> = {
  scheduled: {
    label: "Zaplanowana",
    badgeClass: "bg-slate-800/70 text-slate-100 border border-slate-700/80"
  },
  in_progress: {
    label: "W toku",
    badgeClass: "bg-sky-500/15 text-sky-100 border border-sky-500/40"
  },
  completed: {
    label: "Zakończona",
    badgeClass: "bg-emerald-500/15 text-emerald-100 border border-emerald-500/40"
  },
  auto_closed: {
    label: "Zamknięta automatycznie",
    badgeClass: "bg-purple-500/15 text-purple-100 border border-purple-500/40"
  },
  skipped: {
    label: "Pominięta",
    badgeClass: "bg-amber-500/15 text-amber-100 border border-amber-500/40"
  },
  expired: {
    label: "Wygasła",
    badgeClass: "bg-rose-500/15 text-rose-100 border border-rose-500/40"
  }
}

export function routineCompletionCopy(
  routine: FamilyProgressRoutineSummaryDto
): string {
  const totalChildren = routine.children.length
  const completedChildren = routine.children.filter(
    (child) => child.status === "completed"
  ).length

  if (!totalChildren) {
    return "Brak dzieci przypisanych do rutyny"
  }

  return `${completedChildren}/${totalChildren} dzieci ukończyło`
}

const polishFormatter = new Intl.DateTimeFormat("pl-PL", {
  weekday: "long",
  month: "long",
  day: "numeric"
})

export function formatPolishDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) {
    return date
  }
  return polishFormatter.format(parsed)
}
