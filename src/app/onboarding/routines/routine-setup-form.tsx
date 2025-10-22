"use client"

import { useMemo, useState, useActionState } from "react"
import { AlertCircle, CheckCircle2, ChevronRight } from "lucide-react"

import { saveRoutineSetupAction } from "./actions"
import { ROUTINE_TEMPLATES, ROUTINE_TYPES, type RoutineType } from "@/data/routine-templates"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

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

type RoutineSetupFormProps = {
  familyId: string
  routines: Map<RoutineType, RoutineRecord>
  childProfiles: ChildSummary[]
}

type RoutineSetupState = {
  status: "idle" | "success" | "error"
  message?: string
}

const initialState: RoutineSetupState = { status: "idle" }

export function RoutineSetupForm({ familyId, routines, childProfiles }: RoutineSetupFormProps) {
  const [state, formAction] = useActionState(saveRoutineSetupAction, initialState)
  const [expandedRoutine, setExpandedRoutine] = useState<RoutineType | null>(null)

  const hasChildren = childProfiles.length > 0

  const childList = useMemo(() => (
    childProfiles.length === 0
      ? "Brak dodanych dzieci"
      : childProfiles.map((child) => child.displayName).join(", ")
  ), [childProfiles])

  return (
    <div className="space-y-6">
      {!hasChildren ? (
        <Alert variant="destructive" className="border-red-500/40 bg-red-500/10 text-red-100">
          <AlertCircle className="size-4" aria-hidden />
          <AlertTitle>Brak dzieci w rodzinie</AlertTitle>
          <AlertDescription>
            Najpierw dodaj przynajmniej jedno dziecko w kroku poprzednim, aby przypisać zadania do rutyn.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-emerald-500/40 bg-emerald-500/10 text-emerald-100">
          <CheckCircle2 className="size-4" aria-hidden />
          <AlertTitle>Konfiguracja dotyczy wszystkich dzieci</AlertTitle>
          <AlertDescription>
            Wybrane zadania zostaną skopiowane do rutyn dla: {childList}.
          </AlertDescription>
        </Alert>
      )}

      {state.status === "error" ? (
        <Alert variant="destructive" className="border-red-500/40 bg-red-500/10 text-red-100">
          <AlertCircle className="size-4" aria-hidden />
          <AlertTitle>Nie udało się zapisać rutyn</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      {state.status === "success" ? (
        <Alert className="border-emerald-500/40 bg-emerald-500/10 text-emerald-100">
          <CheckCircle2 className="size-4" aria-hidden />
          <AlertTitle>Rutyny zapisane</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <form action={formAction} className="space-y-6">
        <input type="hidden" name="familyId" value={familyId} />
        {ROUTINE_TYPES.map((routineType) => {
          const routine = routines.get(routineType)!
          const templates = ROUTINE_TEMPLATES[routineType]

          return (
            <Card key={routineType} className="border-slate-800/60 bg-slate-950/40 text-slate-100">
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <CardTitle className="text-xl font-semibold">
                    {ROUTINE_TYPES_LABELS[routineType]}
                  </CardTitle>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto gap-2 px-2 text-xs text-slate-300 hover:text-white"
                    onClick={() => setExpandedRoutine((prev) => (prev === routineType ? null : routineType))}
                  >
                    Podgląd zadań
                    <ChevronRight
                      className={cn(
                        "size-4 transition-transform",
                        expandedRoutine === routineType ? "rotate-90" : ""
                      )}
                      aria-hidden
                    />
                  </Button>
                </div>
                <CardDescription className="text-sm text-slate-200/80">
                  Zdefiniuj okno czasowe i zadania tej rutyny. Automatyczne zamknięcie zakończy sesję po wybranym
                  czasie, licząc od startu.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-3">
                  <label className="flex flex-col gap-2 text-sm">
                    <span className="font-medium text-white">Godzina rozpoczęcia</span>
                    <Input type="time" name={`${routineType}-start`} defaultValue={routine.startTime} required />
                  </label>
                  <label className="flex flex-col gap-2 text-sm">
                    <span className="font-medium text-white">Godzina zakończenia</span>
                    <Input type="time" name={`${routineType}-end`} defaultValue={routine.endTime} required />
                  </label>
                  <label className="flex flex-col gap-2 text-sm">
                    <span className="font-medium text-white">Auto zakończenie (minuty)</span>
                    <Input
                      type="number"
                      name={`${routineType}-autoClose`}
                      min={5}
                      step={5}
                      defaultValue={routine.autoClose}
                      required
                    />
                  </label>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-white">Zadania do skopiowania</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {templates.map((task) => (
                      <label
                        key={task.id}
                        className="flex items-start gap-3 rounded-2xl border border-slate-800/60 bg-slate-900/50 p-3 text-sm text-slate-200/90"
                      >
                        <Checkbox
                          name={`tasks-${routineType}`}
                          value={task.id}
                          defaultChecked
                          className="mt-1"
                        />
                        <span>
                          <span className="font-semibold text-white">{task.name}</span>
                          <span className="ml-2 text-xs text-teal-200/90">+{task.points} pkt</span>
                          {task.isOptional ? (
                            <span className="ml-2 text-xs uppercase tracking-wide text-slate-400">opcjonalne</span>
                          ) : null}
                          {task.description ? (
                            <p className="text-xs text-slate-300/80">{task.description}</p>
                          ) : null}
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-slate-300/70">
                    Możesz zarządzać zadaniami szczegółowo w panelu po zakończeniu onboardingu.
                  </p>
                </div>

                {expandedRoutine === routineType ? (
                  <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-4 text-xs text-slate-200/80">
                    <p className="font-medium text-white">Zadania kopii:</p>
                    <ul className="mt-2 space-y-1">
                      {templates.map((task, index) => (
                        <li key={task.id} className="flex items-center gap-2">
                          <span className="text-slate-400">{index + 1}.</span>
                          <span>{task.name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )
        })}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button type="submit" size="lg" disabled={!hasChildren} className="w-full sm:w-fit">
            Zapisz rutyny
          </Button>
          <p className="text-xs text-slate-300/80">
            Możesz wrócić do tego kroku później. Wszystkie zmiany można edytować z panelu rodzica.
          </p>
        </div>
      </form>
    </div>
  )
}

const ROUTINE_TYPES_LABELS: Record<RoutineType, string> = {
  morning: "Rutyna poranna",
  afternoon: "Rutyna popołudniowa",
  evening: "Rutyna wieczorna",
}
