"use server"

import { revalidatePath } from "next/cache"

import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase"

export type RoutineTaskReorderState = {
  status: "idle" | "success" | "error"
  message?: string
}

export type RoutineTaskUpdateState = RoutineTaskReorderState

async function getParentContext() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: "Twoja sesja wygasła. Zaloguj się ponownie." } as const
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, family_id, role")
    .eq("auth_user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle()

  if (profileError || !profile?.family_id) {
    return { error: "Nie znaleziono profilu rodzica." } as const
  }

  if (profile.role !== "parent" && profile.role !== "admin") {
    return { error: "Brak uprawnień do edycji rutyny." } as const
  }

  return {
    profileId: profile.id,
    familyId: profile.family_id,
    supabase,
  } as const
}

export async function reorderTasksAction(
  _prev: RoutineTaskReorderState,
  formData: FormData
): Promise<RoutineTaskReorderState> {
  try {
    const context = await getParentContext()
    if ("error" in context) {
      return { status: "error", message: context.error }
    }

    const routineId = formData.get("routineId")

    if (typeof routineId !== "string" || routineId.length === 0) {
      return { status: "error", message: "Brak identyfikatora rutyny." }
    }

    const orders: { taskId: string; position: number }[] = []

    for (const [key, value] of formData.entries()) {
      if (typeof key === "string" && key.startsWith("position-")) {
        const taskId = key.replace("position-", "")
        const position = Number.parseInt(typeof value === "string" ? value : "0", 10)
        if (taskId && Number.isFinite(position) && position > 0) {
          orders.push({ taskId, position })
        }
      }
    }

    if (orders.length === 0) {
      return { status: "error", message: "Nie przekazano żadnych zmian kolejności." }
    }

    const serviceClient = createSupabaseServiceRoleClient()
    const sorted = orders.sort((a, b) => a.position - b.position)

    for (const [index, { taskId, position }] of sorted.entries()) {
      const { error: updateError } = await serviceClient
        .from("routine_tasks")
        .update({ position: position > 0 ? position : index + 1 })
        .eq("id", taskId)
        .eq("routine_id", routineId)

      if (updateError) {
        console.error("[reorderTasksAction] failed", updateError)
        return { status: "error", message: "Nie udało się zapisać nowej kolejności." }
      }
    }

    revalidatePath(`/parent/routines/${routineId}`)
    return { status: "success", message: "Kolejność zadań została zaktualizowana." }
  } catch (error) {
    console.error("[reorderTasksAction] unexpected", error)
    return { status: "error", message: "Wystąpił nieoczekiwany błąd." }
  }
}

export async function updateTaskAction(
  _prev: RoutineTaskUpdateState,
  formData: FormData
): Promise<RoutineTaskUpdateState> {
  try {
    const context = await getParentContext()
    if ("error" in context) {
      return { status: "error", message: context.error }
    }

    const routineId = formData.get("routineId")
    const taskId = formData.get("taskId")
    const pointsValue = formData.get("points")
    const positionValue = formData.get("position")
    const isOptional = formData.get("isOptional") === "true"

    if (typeof routineId !== "string" || routineId.length === 0) {
      return { status: "error", message: "Brak identyfikatora rutyny." }
    }

    if (typeof taskId !== "string" || taskId.length === 0) {
      return { status: "error", message: "Brak identyfikatora zadania." }
    }

    const points = Number.parseInt(typeof pointsValue === "string" ? pointsValue : "0", 10)
    if (!Number.isFinite(points) || points < 0) {
      return { status: "error", message: "Liczba punktów musi być nieujemna." }
    }

    const position = Number.parseInt(typeof positionValue === "string" ? positionValue : "0", 10)
    if (!Number.isFinite(position) || position <= 0) {
      return { status: "error", message: "Pozycja zadania musi być liczbą dodatnią." }
    }

    const serviceClient = createSupabaseServiceRoleClient()
    const { error: updateError } = await serviceClient
      .from("routine_tasks")
      .update({
        points,
        is_optional: isOptional,
        position,
      })
      .eq("id", taskId)
      .eq("routine_id", routineId)

    if (updateError) {
      console.error("[updateTaskAction] failed", updateError)
      return { status: "error", message: "Nie udało się zapisać zmian zadania." }
    }

    revalidatePath(`/parent/routines/${routineId}`)
    return { status: "success", message: "Zadanie zostało zaktualizowane." }
  } catch (error) {
    console.error("[updateTaskAction] unexpected", error)
    return { status: "error", message: "Wystąpił nieoczekiwany błąd." }
  }
}
