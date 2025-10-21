import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/db/database.types"
import type {
  RoutineChildAssignmentsResponseDto,
  RoutineChildAssignmentDto,
  RoutineChildUpsertCommand,
  RoutineChildrenReorderCommand,
  RoutineChildrenReorderResultDto
} from "@/types"
import { mapSupabaseError, ValidationError } from "../_lib/errors"

type Client = SupabaseClient<Database>

export async function listChildAssignments(
  client: Client,
  routineId: string,
  includeDisabled: boolean
): Promise<RoutineChildAssignmentsResponseDto> {
  const query = client
    .from("child_routines")
    .select(
      `child_profile_id, position, is_enabled, created_at, updated_at`
    )
    .eq("routine_id", routineId)
    .order("position", { ascending: true })

  if (!includeDisabled) {
    query.eq("is_enabled", true)
  }

  const { data, error } = await query

  if (error) {
    throw mapSupabaseError(error)
  }

  const assignments: RoutineChildAssignmentDto[] = data.map((row) => ({
    childProfileId: row.child_profile_id,
    position: row.position,
    isEnabled: row.is_enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }))

  return { data: assignments }
}

export async function upsertChildRoutine(
  client: Client,
  routineId: string,
  childProfileId: string,
  command: RoutineChildUpsertCommand
): Promise<RoutineChildAssignmentDto> {
  const { data, error } = await client
    .from("child_routines")
    .upsert(
      {
        routine_id: routineId,
        child_profile_id: childProfileId,
        position: command.position,
        is_enabled: command.isEnabled,
        updated_at: new Date().toISOString()
      },
      { onConflict: "routine_id,child_profile_id" }
    )
    .select(
      `child_profile_id, position, is_enabled, created_at, updated_at`
    )
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  if (!data) {
    throw new ValidationError("Failed to update child routine assignment")
  }

  return {
    childProfileId: data.child_profile_id,
    position: data.position,
    isEnabled: data.is_enabled,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  }
}

export async function reorderChildRoutines(
  client: Client,
  routineId: string,
  command: RoutineChildrenReorderCommand
): Promise<RoutineChildrenReorderResultDto> {
  const uniquePositions = new Set<number>()

  command.orders.forEach((entry) => {
    if (uniquePositions.has(entry.position)) {
      throw new ValidationError("Duplicate positions detected")
    }
    uniquePositions.add(entry.position)
  })

  const positions = Array.from(uniquePositions.values()).sort((a, b) => a - b)
  if (positions[0] !== 1 || positions[positions.length - 1] !== positions.length) {
    throw new ValidationError("Positions must be contiguous starting at 1")
  }

  const updates = command.orders.map((entry) =>
    client
      .from("child_routines")
      .update({
        position: entry.position,
        updated_at: new Date().toISOString()
      })
      .eq("routine_id", routineId)
      .eq("child_profile_id", entry.childProfileId)
  )

  const results = await Promise.all(updates)

  for (const result of results) {
    if (result.error) {
      throw mapSupabaseError(result.error)
    }
  }

  return { message: "Positions updated" }
}

export async function assertChildAssignedToRoutine(
  client: Client,
  routineId: string,
  childProfileId: string
): Promise<void> {
  const { data, error } = await client
    .from("child_routines")
    .select("id")
    .eq("routine_id", routineId)
    .eq("child_profile_id", childProfileId)
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  if (!data) {
    throw new ValidationError("Child is not assigned to this routine")
  }
}
