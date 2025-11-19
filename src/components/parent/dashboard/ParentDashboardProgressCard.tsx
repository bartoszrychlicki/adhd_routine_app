import { Sparkles } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type {
  FamilyProgressChildSummaryDto,
  FamilyProgressRoutineSummaryDto,
  FamilyProgressSummaryDto
} from "@/types"
import {
  SESSION_STATUS_META,
  formatDuration,
  formatPolishDate,
  routineCompletionCopy
} from "@/lib/parent/dashboard"

type ParentDashboardProgressCardProps = {
  summary?: FamilyProgressSummaryDto | null
  heading: string
  dateLabel?: string
  badge?: string
  childNames: Record<string, string>
  isFallback?: boolean
}

export function ParentDashboardProgressCard({
  summary,
  heading,
  dateLabel,
  badge,
  childNames,
  isFallback
}: ParentDashboardProgressCardProps) {
  const hasData = summary && summary.routines.length > 0

  return (
    <Card className="border-slate-800/60 bg-slate-900/40 text-slate-100">
      <CardHeader className="flex flex-col gap-2 text-left">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-white">{heading}</CardTitle>
          {badge ? (
            <Badge variant="outline" className="border-teal-500/40 bg-teal-500/10 text-xs text-teal-50">
              {badge}
            </Badge>
          ) : null}
        </div>
        <CardDescription className="text-sm text-slate-300">
          {dateLabel ? formatPolishDate(dateLabel) : "Brak wybranej daty"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasData ? (
          summary!.routines.map((routine) => (
            <RoutineBlock
              key={routine.routineId}
              routine={routine}
              childNames={childNames}
            />
          ))
        ) : (
          <EmptyState isFallback={isFallback} />
        )}
      </CardContent>
    </Card>
  )
}

type RoutineBlockProps = {
  routine: FamilyProgressRoutineSummaryDto
  childNames: Record<string, string>
}

function RoutineBlock({ routine, childNames }: RoutineBlockProps) {
  return (
    <div className="rounded-2xl border border-slate-800/70 bg-slate-950/30 p-4">
      <div className="flex flex-col gap-1">
        <p className="text-base font-semibold text-white">{routine.name || "Bez nazwy"}</p>
        <p className="text-xs uppercase tracking-wide text-slate-400">{routineCompletionCopy(routine)}</p>
      </div>
      <div className="mt-4 flex flex-col gap-3">
        {routine.children.map((child) => (
          <ChildRow
            key={`${routine.routineId}-${child.childProfileId}`}
            child={child}
            childName={childNames[child.childProfileId] ?? "Dziecko"}
          />
        ))}
      </div>
    </div>
  )
}

type ChildRowProps = {
  child: FamilyProgressChildSummaryDto
  childName: string
}

function ChildRow({ child, childName }: ChildRowProps) {
  const progress = getTaskProgress(child)
  const durationLabel = formatDuration(child.durationSeconds)
  const sessionMeta = SESSION_STATUS_META[child.status] ?? SESSION_STATUS_META.scheduled

  return (
    <div className="rounded-xl border border-slate-800/70 bg-slate-900/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-sm font-medium text-white">{childName}</p>
        <Badge className={cn("text-xs font-medium", sessionMeta.badgeClass)}>{sessionMeta.label}</Badge>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300">
        <span>
          {progress.completed}/{progress.total} zadań ukończonych
        </span>
        {durationLabel ? <span>Czas: {durationLabel}</span> : null}
      </div>
      <TaskChips tasks={child.tasks ?? []} />
    </div>
  )
}

type TaskChipsProps = {
  tasks: FamilyProgressChildSummaryDto["tasks"]
}

function TaskChips({ tasks }: TaskChipsProps) {
  if (!tasks?.length) {
    return null
  }

  const preview = tasks.slice(0, 4)
  const remaining = tasks.length - preview.length

  return (
    <div className="mt-2 flex flex-wrap gap-1 text-xs">
      {preview.map((task) => (
        <span
          key={task.taskId}
          className={cn(
            "rounded-full border px-2 py-0.5",
            task.status === "completed"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-50"
              : "border-slate-700/80 bg-slate-800/60 text-slate-200"
          )}
        >
          {task.name}
        </span>
      ))}
      {remaining > 0 ? (
        <span className="rounded-full border border-slate-700/80 bg-slate-800/60 px-2 py-0.5 text-slate-300">
          +{remaining} więcej
        </span>
      ) : null}
    </div>
  )
}

type EmptyStateProps = {
  isFallback?: boolean
}

function EmptyState({ isFallback }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-slate-800/60 bg-slate-950/30 p-6 text-sm text-slate-400">
      <Sparkles className="size-5 text-slate-500" aria-hidden />
      <p className="text-base font-medium text-white">Nie znaleziono danych</p>
      <p>
        {isFallback
          ? "Brak starszych danych w wybranym oknie. Spróbuj wybrać bliższą datę."
          : "Wygląda na to, że dzieci nie mają jeszcze ukończonych rutyn w tym dniu."}
      </p>
    </div>
  )
}

function getTaskProgress(child: FamilyProgressChildSummaryDto) {
  const tasks = child.tasks ?? []
  const completed = tasks.filter((task) => task.status === "completed").length
  return { completed, total: tasks.length }
}
