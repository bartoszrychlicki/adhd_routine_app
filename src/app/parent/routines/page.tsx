import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { Info } from "lucide-react"

import { RoutineEditor } from "./(components)/routine-editor"
import { getActiveProfile } from "@/lib/auth/get-active-profile"
import { createSupabaseServerClient } from "@/lib/supabase"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export const metadata: Metadata = {
  title: "Rutyny rodzica",
  description: "Zarządzaj rutynami i zadaniami dla swoich dzieci.",
}

export default async function ParentRoutinesPage() {
  const activeProfile = await getActiveProfile()

  if (!activeProfile) {
    redirect("/auth/parent")
  }

  if (!activeProfile.familyId) {
    throw new Error("Brak przypisanej rodziny.")
  }

  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from("routines")
    .select(
      `id, name, routine_type, start_time, end_time, auto_close_after_minutes, is_active,
       routine_tasks(id, name, points, position, is_optional, is_active)`
    )
    .eq("family_id", activeProfile.familyId)
    .is("deleted_at", null)
    .order("routine_type", { ascending: true })

  if (error) {
    console.error("[ParentRoutinesPage] failed to load", error)
    throw new Error("Nie udało się pobrać listy rutyn.")
  }

  // Sort tasks by position and deduplicate by name (to show unified view)
  const routines = (data ?? []).map((routine) => {
    const uniqueTasks = new Map<string, any>()

      ; (routine.routine_tasks ?? []).forEach((task) => {
        if (!uniqueTasks.has(task.name)) {
          uniqueTasks.set(task.name, task)
        }
      })

    const tasks = Array.from(uniqueTasks.values())
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((task) => ({
        id: task.id,
        name: task.name,
        points: task.points,
        position: task.position ?? 0,
        isOptional: task.is_optional,
        isActive: task.is_active,
      }))

    return {
      ...routine,
      tasks,
    }
  })

  return (
    <div className="flex flex-col gap-6 pb-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-white">Edycja rutyn</h1>
        <p className="text-slate-400">
          Dostosuj zadania, punkty i kolejność dla każdej pory dnia. Zmiany są zapisywane automatycznie.
        </p>
      </div>

      <Alert className="border-blue-500/20 bg-blue-500/10 text-blue-200">
        <Info className="size-4" />
        <AlertTitle>Wskazówka</AlertTitle>
        <AlertDescription>
          Możesz przeciągać zadania, aby zmienić ich kolejność. Kliknij na punkty, aby je szybko zmienić.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-2">
        {routines.map((routine) => (
          <RoutineEditor
            key={routine.id}
            routine={{
              id: routine.id,
              name: routine.name,
              routineType: routine.routine_type,
              startTime: routine.start_time,
              endTime: routine.end_time,
              isActive: routine.is_active,
            }}
            tasks={routine.tasks}
          />
        ))}
      </div>
    </div>
  )
}
