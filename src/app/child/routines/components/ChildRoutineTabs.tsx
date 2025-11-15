"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { SessionTimer } from "@/components/child/session-timer"
import type { RoutineSessionStartDto } from "@/types"

export type RoutineTaskStatus = "pending" | "completed"

export type RoutineTask = {
  id: string
  title: string
  description?: string | null
  status: RoutineTaskStatus
  points?: number
  durationSeconds?: number | null
  durationLabel?: string | null
  isOptional?: boolean
}

export type RoutineTabStatus = "active" | "upcoming" | "completed"

export type RoutineTab = {
  id: string
  sessionId: string
  routineId: string
  sessionDate: string
  name: string
  points: number
  status: RoutineTabStatus
  startLabel?: string | null
  badgeLabel: string
  availabilityMessage?: string | null
  completionSummary?: string | null
  tasks: RoutineTask[]
  isCurrent: boolean
  isLocked: boolean
  isInProgress: boolean
  successHref: string
  sessionStatus: string
  startedAt: string | null
  plannedEndAt: string | null
  bestDurationSeconds: number | null
  bestTimeBeaten: boolean
  completedTasks: Array<{ taskId: string; completedAt?: string | null }>
  mandatoryTaskIds: string[]
}

export type ChildRoutineTabsProps = {
  tabs: RoutineTab[]
  childId: string
  familyId: string
  onSelectTab?: (id: string) => void
}

function getInitialTabId(tabs: RoutineTab[]): string {
  if (tabs.length === 0) return ""
  const current = tabs.find((tab) => tab.isCurrent)
  return current?.id ?? tabs[0]!.id
}

type SessionMeta = {
  status: string
  startedAt: string | null
  plannedEndAt: string | null
}

function createSessionMeta(tabs: RoutineTab[]): Record<string, SessionMeta> {
  return Object.fromEntries(
    tabs.map((tab) => [
      tab.id,
      {
        status: tab.sessionStatus,
        startedAt: tab.startedAt,
        plannedEndAt: tab.plannedEndAt,
      },
    ])
  )
}

function formatBestDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) {
    return "Brak rekordu"
  }

  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes.toString().padStart(2, "0")}:${remainder.toString().padStart(2, "0")}`
}

function buildAuthHeaders(profileId: string, familyId: string) {
  return {
    "x-debug-profile-id": profileId,
    "x-debug-family-id": familyId,
    "x-debug-role": "child",
  }
}

export function ChildRoutineTabs({ tabs, childId, familyId, onSelectTab }: ChildRoutineTabsProps) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState(() => getInitialTabId(tabs))
  const [sessionMeta, setSessionMeta] = useState<Record<string, SessionMeta>>(() => createSessionMeta(tabs))
  const [completionState, setCompletionState] = useState<Record<string, Record<string, string | null>>>(() =>
    Object.fromEntries(
      tabs.map((tab) => [tab.id, Object.fromEntries(tab.completedTasks.map((entry) => [entry.taskId, entry.completedAt ?? null]))])
    )
  )
  const [routineCompleted, setRoutineCompleted] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(tabs.map((tab) => [tab.id, tab.sessionStatus === "completed"]))
  )
  const [finishPending, setFinishPending] = useState<Record<string, boolean>>({})
  const [errorState, setErrorState] = useState<Record<string, string | null>>({})
  const [startPending, setStartPending] = useState<Record<string, boolean>>({})
  const [startErrors, setStartErrors] = useState<Record<string, string | null>>({})

  useEffect(() => {
    if (!tabs.length) {
      if (selectedId) {
        setSelectedId("")
      }
      return
    }

    const hasSelected = tabs.some((tab) => tab.id === selectedId)
    if (!hasSelected) {
      setSelectedId(getInitialTabId(tabs))
    }
  }, [tabs, selectedId])

  useEffect(() => {
    setSessionMeta(createSessionMeta(tabs))
  }, [tabs])

  useEffect(() => {
    const initialCompletion = Object.fromEntries(
      tabs.map((tab) => [tab.id, Object.fromEntries(tab.completedTasks.map((entry) => [entry.taskId, entry.completedAt ?? null]))])
    )
    setCompletionState((prev) => {
      const next = { ...initialCompletion }
      for (const [tabId, completed] of Object.entries(prev)) {
        next[tabId] = { ...(initialCompletion[tabId] ?? {}), ...completed }
      }
      return next
    })
    setRoutineCompleted((prev) => {
      const base = Object.fromEntries(tabs.map((tab) => [tab.id, tab.sessionStatus === "completed"]))
      return { ...base, ...prev }
    })
  }, [tabs])

  useEffect(() => {
    if (selectedId) {
      onSelectTab?.(selectedId)
    }
  }, [selectedId, onSelectTab])

  const selectedTab = useMemo(() => tabs.find((tab) => tab.id === selectedId), [tabs, selectedId])

  if (!tabs.length) {
    return (
      <Card data-testid="child-routine-tabs-empty" className="border-slate-800/60 bg-slate-950/70 text-slate-100">
        <CardHeader>
          <CardTitle>Brak zaplanowanych rutyn</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-300">
            Wygląda na to, że nie masz jeszcze żadnych misji. Poproś rodzica o zaplanowanie rutyny lub spróbuj ponownie
            później.
          </p>
        </CardContent>
      </Card>
    )
  }

  const activeSessionStatus = sessionMeta[selectedId]?.status ?? selectedTab?.sessionStatus ?? "scheduled"
  const activeTabInProgress = activeSessionStatus === "in_progress"

  const handleTabChange = (nextId: string) => {
    setSelectedId(nextId)
  }

  const markTaskCompleted = (tab: RoutineTab, taskId: string) => {
    const meta = sessionMeta[tab.id] ?? {
      status: tab.sessionStatus,
      startedAt: tab.startedAt,
      plannedEndAt: tab.plannedEndAt,
    }

    if ((meta.status ?? tab.sessionStatus) !== "in_progress") {
      return
    }

    setCompletionState((prev) => {
      const tabState = prev[tab.id] ?? {}
      if (tabState[taskId]) {
        return prev
      }
      return {
        ...prev,
        [tab.id]: {
          ...tabState,
          [taskId]: new Date().toISOString(),
        },
      }
    })
    setErrorState((prev) => ({ ...prev, [tab.id]: null }))
  }

  const handleFinishRoutine = async (
    tab: RoutineTab,
    allMandatoryCompleted: boolean,
    completionEntries: Array<{ taskId: string; completedAt: string | null }>
  ) => {
    if (tab.status !== "active") {
      return
    }

    const meta = sessionMeta[tab.id] ?? {
      status: tab.sessionStatus,
      startedAt: tab.startedAt,
      plannedEndAt: tab.plannedEndAt,
    }
    const sessionStatus = meta.status ?? tab.sessionStatus
    const alreadyCompleted = routineCompleted[tab.id] || sessionStatus === "completed"

    if (alreadyCompleted) {
      router.push(tab.successHref)
      router.refresh()
      return
    }

    if (sessionStatus !== "in_progress") {
      setErrorState((prev) => ({
        ...prev,
        [tab.id]: "Aby zakończyć misję, najpierw uruchom timer.",
      }))
      return
    }

    if (!allMandatoryCompleted) {
      return
    }

    if (!completionEntries.length && tab.tasks.length === 0) {
      router.push(tab.successHref)
      router.refresh()
      return
    }

    setFinishPending((prev) => ({ ...prev, [tab.id]: true }))
    setErrorState((prev) => ({ ...prev, [tab.id]: null }))

    try {
      const payload = {
        completedTasks: completionEntries.map((entry) => ({
          taskId: entry.taskId,
          completedAt: entry.completedAt ?? new Date().toISOString(),
        })),
      }

      const response = await fetch(`/api/v1/sessions/${tab.sessionId}/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildAuthHeaders(childId, familyId),
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null)
        const message =
          (errorBody && typeof errorBody?.error?.message === "string"
            ? errorBody.error.message
            : null) ?? "Nie udało się zakończyć rutyny."
        throw new Error(message)
      }

      setRoutineCompleted((prev) => ({ ...prev, [tab.id]: true }))
      setSessionMeta((prev) => ({
        ...prev,
        [tab.id]: {
          status: "completed",
          startedAt: prev[tab.id]?.startedAt ?? meta.startedAt,
          plannedEndAt: prev[tab.id]?.plannedEndAt ?? meta.plannedEndAt,
        },
      }))
      router.push(tab.successHref)
      router.refresh()
    } catch (error) {
      setErrorState((prev) => ({
        ...prev,
        [tab.id]: error instanceof Error ? error.message : "Wystąpił nieoczekiwany błąd.",
      }))
    } finally {
      setFinishPending((prev) => ({ ...prev, [tab.id]: false }))
  }
}

  const handleStartRoutine = async (tab: RoutineTab) => {
    const meta = sessionMeta[tab.id] ?? {
      status: tab.sessionStatus,
      startedAt: tab.startedAt,
      plannedEndAt: tab.plannedEndAt,
    }

    if (meta.status === "in_progress") {
      return
    }

    setStartPending((prev) => ({ ...prev, [tab.id]: true }))
    setStartErrors((prev) => ({ ...prev, [tab.id]: null }))

    try {
      const payload = {
        routineId: tab.routineId,
        sessionDate: tab.sessionDate,
        autoStartTimer: true,
      }

      const response = await fetch(`/api/v1/children/${childId}/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildAuthHeaders(childId, familyId),
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error("Nie udało się rozpocząć rutyny.")
      }

      const data = (await response.json()) as RoutineSessionStartDto

      setSessionMeta((prev) => ({
        ...prev,
        [tab.id]: {
          status: data.status ?? "in_progress",
          startedAt: data.startedAt ?? new Date().toISOString(),
          plannedEndAt: data.plannedEndAt ?? meta.plannedEndAt,
        },
      }))

      router.refresh()
    } catch (error) {
      setStartErrors((prev) => ({
        ...prev,
        [tab.id]: error instanceof Error ? error.message : "Nie udało się rozpocząć rutyny.",
      }))
    } finally {
      setStartPending((prev) => ({ ...prev, [tab.id]: false }))
    }
  }

  return (
    <div data-testid="child-routine-tabs" className="flex flex-col gap-6">
      <Tabs value={selectedId} onValueChange={handleTabChange}>
        <TabsList aria-label="Wybierz rutynę" className="flex-wrap gap-2 bg-slate-950/40">
          {tabs.map((tab) => {
            const meta = sessionMeta[tab.id] ?? {
              status: tab.sessionStatus,
              startedAt: tab.startedAt,
              plannedEndAt: tab.plannedEndAt,
            }
            const isSelected = tab.id === selectedId
            const tabStatus = meta.status ?? tab.sessionStatus
            const tabInProgress = tabStatus === "in_progress"
            const shouldLock = !isSelected && (tab.isLocked || activeTabInProgress || tabInProgress)
            const lockMessage = "Zakończ aktualną rutynę, aby zobaczyć pozostałe."

            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                disabled={shouldLock}
                aria-disabled={shouldLock ? "true" : "false"}
                aria-label={`${tab.name} (${tab.points} pkt)`}
                title={shouldLock ? lockMessage : undefined}
                className={cn(
                  "flex min-w-[200px] flex-col items-start gap-1 rounded-2xl border border-transparent px-5 py-3 text-left transition",
                  "data-[state=active]:border-teal-500/70 data-[state=active]:bg-slate-900 data-[state=inactive]:bg-slate-900/30",
                  shouldLock && "cursor-not-allowed opacity-60"
                )}
              >
                <span className="text-sm font-semibold text-white">{`${tab.name} (${tab.points} pkt)`}</span>
                <Badge
                  variant="outline"
                  aria-hidden="true"
                  className={cn(
                    "rounded-full border border-slate-700/70 px-2 py-0.5 text-[11px] uppercase tracking-wide",
                    tab.status === "active" && "border-teal-400/70 text-teal-200",
                    tab.status === "upcoming" && "border-indigo-400/70 text-indigo-200",
                    tab.status === "completed" && "border-emerald-400/70 text-emerald-200"
                  )}
                >
                  {tab.badgeLabel}
                </Badge>
              </TabsTrigger>
            )
          })}
        </TabsList>

        {tabs.map((tab) => {
          const meta = sessionMeta[tab.id] ?? {
            status: tab.sessionStatus,
            startedAt: tab.startedAt,
            plannedEndAt: tab.plannedEndAt,
          }
          const completionMap = completionState[tab.id] ?? {}
          const completedSet = new Set(Object.keys(completionMap))
          const orderedTasks = tab.tasks
          const hasTasks = orderedTasks.length > 0
          const sessionStatus = meta.status ?? tab.sessionStatus
          const sessionStarted = sessionStatus === "in_progress"
          const routineIsCompleted = routineCompleted[tab.id] || sessionStatus === "completed"
          const firstIncompleteIndex = sessionStarted
            ? orderedTasks.findIndex((task) => !completedSet.has(task.id))
            : -1
          const activeIndex = firstIncompleteIndex === -1 ? null : firstIncompleteIndex
          const allMandatoryCompleted = tab.mandatoryTaskIds.every((taskId) => completedSet.has(taskId))
          const remainingMandatory = tab.mandatoryTaskIds.filter((taskId) => !completedSet.has(taskId)).length
          const finishDisabled = routineIsCompleted
            ? Boolean(finishPending[tab.id])
            : tab.status !== "active" || !sessionStarted || finishPending[tab.id] || !allMandatoryCompleted

          const completionEntries = Array.from(completedSet).map((taskId) => ({
            taskId,
            completedAt: completionMap[taskId] ?? null,
          }))

          const showStartCallout = tab.status === "active" && !sessionStarted && !routineIsCompleted
          const bestDurationLabel = formatBestDuration(tab.bestDurationSeconds)
          let finishHelper: string | null = null
          if (!routineIsCompleted) {
            if (!sessionStarted) {
              finishHelper = "Uruchom timer, aby rozpocząć misję."
            } else if (remainingMandatory > 0) {
              finishHelper =
                remainingMandatory === 1
                  ? "Pozostało 1 obowiązkowe zadanie."
                  : `Pozostało ${remainingMandatory} obowiązkowe zadania.`
            }
          }

          return (
            <TabsContent key={tab.id} value={tab.id}>
              <div className="flex flex-col gap-6">
                {tab.status === "active" ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <SessionTimer startedAt={meta.startedAt ?? undefined} plannedEndAt={meta.plannedEndAt ?? undefined} />
                      <div className="flex flex-col gap-1 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-100">
                        <span className="text-sm font-semibold text-white">Rekord: {bestDurationLabel}</span>
                        {routineIsCompleted && tab.bestTimeBeaten ? (
                          <span>Ostatnia misja pobiła rekord czasu!</span>
                        ) : (
                          <span>Spróbuj pobić swój najlepszy wynik.</span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}

                {showStartCallout ? (
                  <Card className="border-teal-400/40 bg-teal-500/10 text-teal-50">
                    <CardContent className="flex flex-col gap-4 py-4">
                      <div className="text-sm">
                        Aby zacząć tę misję, kliknij „Start”. Timer uruchomi się automatycznie i nie będzie można go zatrzymać.
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                        <Button
                          type="button"
                          onClick={() => handleStartRoutine(tab)}
                          disabled={startPending[tab.id]}
                          className="sm:w-auto"
                        >
                          {startPending[tab.id] ? "Uruchamiam..." : "Start"}
                        </Button>
                        {startErrors[tab.id] ? (
                          <p className="text-sm text-rose-100/90">{startErrors[tab.id]}</p>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                ) : null}

                {tab.availabilityMessage && (
                  <Card className="border-indigo-400/40 bg-indigo-500/10 text-indigo-50">
                    <CardContent className="py-4 text-sm">{tab.availabilityMessage}</CardContent>
                  </Card>
                )}

                {tab.completionSummary && (
                  <Card className="border-emerald-400/40 bg-emerald-500/10 text-emerald-50">
                    <CardContent className="py-4 text-sm">{tab.completionSummary}</CardContent>
                  </Card>
                )}

                <section aria-labelledby={`routine-${tab.id}-tasks`} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 id={`routine-${tab.id}-tasks`} className="text-lg font-semibold text-white">
                      Zadania
                    </h3>
                    {tab.startLabel && (
                      <span className="text-sm text-slate-300">
                        {tab.status === "active" ? "Okno czasowe" : "Plan"}: {tab.startLabel}
                      </span>
                    )}
                  </div>

                  <ul role="list" aria-label="Zadania rutyny" className="flex flex-col gap-3">
                    {hasTasks ? (
                      orderedTasks.map((task, index) => {
                        const isCompleted = completedSet.has(task.id) || task.status === "completed"
                        const isInactive = tab.status !== "active" || !sessionStarted
                        const isActiveTask = sessionStarted && !isInactive && activeIndex === index
                        const disableAction =
                          isInactive || isCompleted || startPending[tab.id] || (activeIndex !== null && index !== activeIndex)

                        return (
                          <li
                            key={task.id}
                            role="listitem"
                            aria-label={isCompleted ? "Zadanie ukończone" : undefined}
                            data-status={isCompleted ? "completed" : "pending"}
                            data-inactive={isInactive ? "true" : undefined}
                            className={cn(
                              "flex items-center justify-between gap-4 rounded-2xl border border-slate-800/70 bg-slate-900/50 px-4 py-3 transition",
                              isInactive && "pointer-events-none opacity-60",
                              isCompleted && "border-emerald-500/50 bg-emerald-500/10",
                              !isInactive && isActiveTask && "border-teal-400/60 bg-teal-500/10"
                            )}
                          >
                            <div className="flex flex-1 flex-col gap-1">
                              <span className="text-sm font-medium text-slate-100">{task.title}</span>
                              {task.description ? (
                                <span className="text-xs text-slate-300/80">{task.description}</span>
                              ) : null}
                              <div className="text-xs text-slate-400">
                                {task.points ? `${task.points} pkt` : null}
                                {task.points && task.durationLabel ? " • " : null}
                                {task.durationLabel}
                                {task.isOptional ? " • Opcjonalne" : null}
                              </div>
                            </div>
                            {tab.status === "active" ? (
                              <Button
                                type="button"
                                size="sm"
                                variant={isCompleted ? "secondary" : "outline"}
                                className={cn(
                                  "rounded-full px-4",
                                  isCompleted
                                    ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-100"
                                    : "border-teal-400/40 bg-teal-500/10 text-teal-100"
                                )}
                                disabled={disableAction}
                                onClick={() => markTaskCompleted(tab, task.id)}
                              >
                                {isCompleted ? "Gotowe" : "Zrobione"}
                              </Button>
                            ) : null}
                          </li>
                        )
                      })
                    ) : (
                      <li
                        role="listitem"
                        data-empty="true"
                        className="rounded-2xl border border-slate-800/70 bg-slate-900/40 px-4 py-6 text-center text-sm text-slate-300"
                      >
                        Brak zadań w tej rutynie. Ostatnio ukończono w {tab.completionSummary ?? "nieznanym czasie"}.
                      </li>
                    )}
                  </ul>
                </section>

                {(tab.status === "active" || routineIsCompleted) && (
                  <footer
                    role="region"
                    aria-label="Panel zakończenia rutyny"
                    className="sticky bottom-0 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4 shadow-lg shadow-black/30 backdrop-blur"
                  >
                    <div className="flex flex-col gap-3">
                      <Button
                        type="button"
                        className={cn(
                          "w-full rounded-2xl font-semibold text-slate-950 shadow-[0_18px_45px_rgba(56,189,248,0.35)] transition-colors",
                          routineIsCompleted
                            ? "bg-emerald-400 hover:bg-emerald-300"
                            : "bg-sky-300 hover:bg-sky-200",
                          "disabled:bg-slate-500/30 disabled:text-slate-300 disabled:shadow-none"
                        )}
                        disabled={finishDisabled}
                        onClick={() => handleFinishRoutine(tab, allMandatoryCompleted, completionEntries)}
                      >
                        {routineIsCompleted ? "Przejdź dalej" : "Zakończ rutynę"}
                      </Button>
                      {finishHelper ? (
                        <p className="text-sm text-slate-300">{finishHelper}</p>
                      ) : null}
                      {errorState[tab.id] ? (
                        <p className="text-sm text-rose-200/90">{errorState[tab.id]}</p>
                      ) : null}
                    </div>
                  </footer>
                )}
              </div>
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}
