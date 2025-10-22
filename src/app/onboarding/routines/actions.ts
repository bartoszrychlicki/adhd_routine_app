"use server"

import { revalidatePath } from "next/cache"

import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase"
import { ROUTINE_DEFAULTS, ROUTINE_TEMPLATES, type RoutineType } from "@/data/routine-templates"

const ROUTINE_TYPES: RoutineType[] = ["morning", "afternoon", "evening"]

type RoutineSetupState = {
  status: "idle" | "success" | "error"
  message?: string
}

function parseTime(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null
  }

  const time = value.trim()
  const match = /^(\d{2}):(\d{2})$/.exec(time)
  if (!match) {
    throw new Error("Nieprawidłowy format godziny. Użyj HH:MM.")
  }

  return `${match[1]}:${match[2]}:00`
}

function parseAutoClose(value: FormDataEntryValue | null, fallback: number): number {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Limit czasu automatycznego zakończenia musi być dodatnią liczbą minut.")
  }

  return parsed
}

export async function saveRoutineSetupAction(
  _prevState: RoutineSetupState,
  formData: FormData
): Promise<RoutineSetupState> {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return {
        status: "error",
        message: "Twoja sesja wygasła. Zaloguj się ponownie.",
      }
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, family_id, role")
      .eq("auth_user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle()

    if (profileError || !profile?.family_id) {
      return {
        status: "error",
        message: "Nie znaleziono konta rodzica przypisanego do rodziny.",
      }
    }

    if (profile.role !== "parent" && profile.role !== "admin") {
      return {
        status: "error",
        message: "Tylko konto rodzica może konfigurować rutyny.",
      }
    }

    const familyId = profile.family_id
    const serviceClient = createSupabaseServiceRoleClient()

    const { data: children, error: childrenError } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("family_id", familyId)
      .eq("role", "child")
      .is("deleted_at", null)

    if (childrenError) {
      console.error("[saveRoutineSetupAction] Failed to load children", childrenError)
      return {
        status: "error",
        message: "Nie udało się pobrać listy dzieci. Spróbuj ponownie.",
      }
    }

    if (!children || children.length === 0) {
      return {
        status: "error",
        message: "Dodaj przynajmniej jedno dziecko przed konfiguracją rutyn.",
      }
    }

    const { data: existingRoutines, error: routinesError } = await serviceClient
      .from("routines")
      .select("id, routine_type, name")
      .eq("family_id", familyId)
      .is("deleted_at", null)

    if (routinesError) {
      console.error("[saveRoutineSetupAction] Failed to load routines", routinesError)
      return {
        status: "error",
        message: "Nie udało się pobrać rutyn. Spróbuj ponownie.",
      }
    }

    const routineByType = new Map<RoutineType, string>()
    existingRoutines?.forEach((routine) => {
      const type = routine.routine_type as RoutineType | null
      if (type && ROUTINE_TYPES.includes(type)) {
        routineByType.set(type, routine.id)
      }
    })

    const childrenIds = children.map((child) => child.id)

    for (const routineType of ROUTINE_TYPES) {
      const defaults = ROUTINE_DEFAULTS[routineType]
      const startTime = parseTime(formData.get(`${routineType}-start`)) ?? `${defaults.start}:00`
      const endTime = parseTime(formData.get(`${routineType}-end`)) ?? `${defaults.end}:00`
      const autoClose = parseAutoClose(formData.get(`${routineType}-autoClose`), defaults.autoClose)

      let routineId = routineByType.get(routineType)

      if (!routineId) {
        const { data: newRoutine, error: insertError } = await serviceClient
          .from("routines")
          .insert({
            family_id: familyId,
            name: ROUTINE_DEFAULTS[routineType].name,
            slug: routineType,
            routine_type: routineType,
            start_time: startTime,
            end_time: endTime,
            auto_close_after_minutes: autoClose,
            settings: {},
          })
          .select("id")
          .maybeSingle()

        if (insertError || !newRoutine) {
          console.error("[saveRoutineSetupAction] Failed to create routine", routineType, insertError)
          return {
            status: "error",
            message: "Nie udało się utworzyć rutyny. Spróbuj ponownie.",
          }
        }

        routineId = newRoutine.id
        routineByType.set(routineType, routineId)
      } else {
        const { error: updateError } = await serviceClient
          .from("routines")
          .update({
            start_time: startTime,
            end_time: endTime,
            auto_close_after_minutes: autoClose,
          })
          .eq("id", routineId)

        if (updateError) {
          console.error("[saveRoutineSetupAction] Failed to update routine", routineType, updateError)
          return {
            status: "error",
            message: "Nie udało się zaktualizować ustawień rutyny.",
          }
        }
      }

      await serviceClient
        .from("child_routines")
        .delete()
        .eq("routine_id", routineId)

      const assignments = childrenIds.map((childId, index) => ({
        routine_id: routineId,
        child_profile_id: childId,
        position: index + 1,
        is_enabled: true,
      }))

      if (assignments.length > 0) {
        const { error: assignError } = await serviceClient
          .from("child_routines")
          .insert(assignments)

        if (assignError) {
          console.error("[saveRoutineSetupAction] Failed to assign children", assignError)
          return {
            status: "error",
            message: "Nie udało się przypisać dzieci do rutyny.",
          }
        }
      }

      const selectedTaskIds = formData.getAll(`tasks-${routineType}`)
        .map((value) => (typeof value === "string" ? value : ""))
        .filter(Boolean)

      const templateMap = new Map(ROUTINE_TEMPLATES[routineType].map((task) => [task.id, task]))

      await serviceClient
        .from("routine_tasks")
        .delete()
        .eq("routine_id", routineId)

      if (selectedTaskIds.length > 0) {
        for (const childId of childrenIds) {
          const tasksToInsert = selectedTaskIds.map((taskId, index) => {
            const template = templateMap.get(taskId)
            if (!template) {
              throw new Error(`Nie znaleziono szablonu zadania: ${taskId}`)
            }

            return {
              routine_id: routineId,
              child_profile_id: childId,
              name: template.name,
              description: template.description ?? null,
              points: template.points,
              position: index + 1,
              is_optional: template.isOptional ?? false,
              expected_duration_seconds: template.expectedDurationSeconds ?? null,
              is_active: true,
            }
          })

          const { error: insertTasksError } = await serviceClient
            .from("routine_tasks")
            .insert(tasksToInsert)

          if (insertTasksError) {
            console.error("[saveRoutineSetupAction] Failed to insert tasks", insertTasksError)
            return {
              status: "error",
              message: "Nie udało się zapisać zadań rutyny.",
            }
          }
        }
      }
    }

    revalidatePath("/onboarding/routines")

    return {
      status: "success",
      message: "Rutyny zostały zaktualizowane.",
    }
  } catch (error) {
    console.error("[saveRoutineSetupAction] Unexpected error", error)
    return {
      status: "error",
      message: "Wystąpił nieoczekiwany błąd. Spróbuj ponownie później.",
    }
  }
}
