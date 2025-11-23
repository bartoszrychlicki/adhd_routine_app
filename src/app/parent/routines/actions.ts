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

export async function toggleRoutineActiveAction(formData: FormData): Promise<void> {
  try {
    const routineId = formData.get("routineId")
    const desiredState = formData.get("isActive")

    if (typeof routineId !== "string" || routineId.length === 0) {
      throw new Error("Brak identyfikatora rutyny.")
    }

    const isActive = desiredState === "true"

    const context = await getParentContext()
    if ("error" in context) {
      throw new Error(context.error)
    }

    const serviceClient = createSupabaseServiceRoleClient()
    const { error: updateError } = await serviceClient
      .from("routines")
      .update({ is_active: isActive })
      .eq("id", routineId)
      .eq("family_id", context.familyId)

    if (updateError) {
      console.error("[toggleRoutineActiveAction] update failed", updateError)
      throw new Error("Nie udało się zaktualizować rutyny.")
    }

    revalidatePath("/parent/routines")
  } catch (error) {
    console.error("[toggleRoutineActiveAction] unexpected", error)
    throw error instanceof Error ? error : new Error("Wystąpił nieoczekiwany błąd.")
  }
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
    const itemsJson = formData.get("items")

    if (typeof routineId !== "string" || !routineId) {
      return { status: "error", message: "Brak identyfikatora rutyny." }
    }

    if (typeof itemsJson !== "string") {
      return { status: "error", message: "Nieprawidłowe dane sortowania." }
    }

    const items = JSON.parse(itemsJson) as { id: string; position: number }[]

    if (!Array.isArray(items) || items.length === 0) {
      return { status: "success", message: "Brak zmian do zapisania." }
    }

    const serviceClient = createSupabaseServiceRoleClient()

    // 1. Prepare items with names (needed to sync across children)
    const itemsWithNames: { id: string; position: number; name: string }[] = []

    for (const item of items) {
      const { data: task } = await serviceClient
        .from("routine_tasks")
        .select("name")
        .eq("id", item.id)
        .single()

      if (task) {
        itemsWithNames.push({ ...item, name: task.name })
      }
    }

    // 2. Pass 1: Update to temporary positions (large offset) to avoid unique constraint violations
    // We use position + 10000 to ensure uniqueness in the temporary state and satisfy check constraints (position > 0)
    const TEMP_OFFSET = 10000

    for (const item of itemsWithNames) {
      const { error } = await serviceClient
        .from("routine_tasks")
        .update({ position: item.position + TEMP_OFFSET })
        .eq("routine_id", routineId)
        .eq("name", item.name)

      if (error) {
        console.error("[reorderTasksAction] failed temp update for item", item, error)
        return { status: "error", message: "Wystąpił błąd podczas zapisywania kolejności (etap 1)." }
      }
    }

    // 3. Pass 2: Update to final positions
    for (const item of itemsWithNames) {
      const { error } = await serviceClient
        .from("routine_tasks")
        .update({ position: item.position })
        .eq("routine_id", routineId)
        .eq("name", item.name)

      if (error) {
        console.error("[reorderTasksAction] failed final update for item", item, error)
        return { status: "error", message: "Wystąpił błąd podczas zapisywania kolejności (etap 2)." }
      }
    }

    revalidatePath("/parent/routines")
    return { status: "success", message: "Kolejność została zaktualizowana." }
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
    const name = formData.get("name")
    const pointsValue = formData.get("points")
    const isOptional = formData.get("isOptional") === "true"

    if (typeof routineId !== "string" || !routineId) {
      return { status: "error", message: "Brak identyfikatora rutyny." }
    }

    if (typeof taskId !== "string" || !taskId) {
      return { status: "error", message: "Brak identyfikatora zadania." }
    }

    const serviceClient = createSupabaseServiceRoleClient()

    // Get the task to find its current name (to match others)
    const { data: currentTask, error: fetchError } = await serviceClient
      .from("routine_tasks")
      .select("name")
      .eq("id", taskId)
      .single()

    if (fetchError || !currentTask) {
      return { status: "error", message: "Nie znaleziono zadania." }
    }

    const updates: Record<string, any> = {
      is_optional: isOptional,
    }

    if (typeof name === "string" && name.trim().length > 0) {
      updates.name = name.trim()
    }

    if (typeof pointsValue === "string") {
      const points = parseInt(pointsValue, 10)
      if (!isNaN(points) && points >= 0) {
        updates.points = points
      }
    }

    // Update ALL tasks with the same name in this routine
    const { error: updateError } = await serviceClient
      .from("routine_tasks")
      .update(updates)
      .eq("routine_id", routineId)
      .eq("name", currentTask.name)

    if (updateError) {
      console.error("[updateTaskAction] failed", updateError)
      return { status: "error", message: "Nie udało się zaktualizować zadania." }
    }

    revalidatePath("/parent/routines")
    return { status: "success", message: "Zadanie zaktualizowane." }
  } catch (error) {
    console.error("[updateTaskAction] unexpected", error)
    return { status: "error", message: "Wystąpił nieoczekiwany błąd." }
  }
}

export async function createTaskAction(
  _prev: RoutineTaskUpdateState,
  formData: FormData
): Promise<RoutineTaskUpdateState> {
  try {
    const context = await getParentContext()
    if ("error" in context) {
      return { status: "error", message: context.error }
    }

    const routineId = formData.get("routineId")
    const name = formData.get("name")
    const pointsRaw = formData.get("points")

    if (typeof routineId !== "string" || !routineId) {
      return { status: "error", message: "Brak identyfikatora rutyny." }
    }

    if (typeof name !== "string" || name.trim().length === 0) {
      return { status: "error", message: "Nazwa zadania jest wymagana." }
    }

    let points = 10
    if (typeof pointsRaw === "string") {
      const parsed = parseInt(pointsRaw, 10)
      if (!isNaN(parsed) && parsed >= 0) {
        points = parsed
      }
    }

    const serviceClient = createSupabaseServiceRoleClient()

    // Get all children in the family
    const { data: children, error: childrenError } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("family_id", context.familyId)
      .eq("role", "child")
      .is("deleted_at", null)

    if (childrenError || !children || children.length === 0) {
      return { status: "error", message: "Brak dzieci w rodzinie." }
    }

    // Get current max position (just take one)
    const { data: maxPosData } = await serviceClient
      .from("routine_tasks")
      .select("position")
      .eq("routine_id", routineId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextPosition = (maxPosData?.position ?? 0) + 1

    // Insert for each child
    const tasksToInsert = children.map(child => ({
      routine_id: routineId,
      child_profile_id: child.id,
      name: name.trim(),
      points: points,
      position: nextPosition,
      is_optional: false,
      is_active: true,
    }))

    const { error: insertError } = await serviceClient
      .from("routine_tasks")
      .insert(tasksToInsert)

    if (insertError) {
      console.error("[createTaskAction] failed", insertError)
      return { status: "error", message: "Nie udało się utworzyć zadania." }
    }

    revalidatePath("/parent/routines")
    return { status: "success", message: "Zadanie utworzone." }
  } catch (error) {
    console.error("[createTaskAction] unexpected", error)
    return { status: "error", message: "Wystąpił nieoczekiwany błąd." }
  }
}

export async function deleteTaskAction(
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

    if (typeof routineId !== "string" || !routineId) {
      return { status: "error", message: "Brak identyfikatora rutyny." }
    }

    if (typeof taskId !== "string" || !taskId) {
      return { status: "error", message: "Brak identyfikatora zadania." }
    }

    const serviceClient = createSupabaseServiceRoleClient()

    // Get task name to delete all instances
    const { data: task } = await serviceClient
      .from("routine_tasks")
      .select("name")
      .eq("id", taskId)
      .single()

    if (!task) {
      return { status: "error", message: "Nie znaleziono zadania." }
    }

    const { error: deleteError } = await serviceClient
      .from("routine_tasks")
      .delete()
      .eq("routine_id", routineId)
      .eq("name", task.name)

    if (deleteError) {
      console.error("[deleteTaskAction] failed", deleteError)
      return { status: "error", message: "Nie udało się usunąć zadania." }
    }

    revalidatePath("/parent/routines")
    return { status: "success", message: "Zadanie usunięte." }
  } catch (error) {
    console.error("[deleteTaskAction] unexpected", error)
    return { status: "error", message: "Wystąpił nieoczekiwany błąd." }
  }
}
