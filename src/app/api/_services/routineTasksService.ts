import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/db/database.types"
import type {
  RoutineTaskCreateCommand,
  RoutineTaskDto,
  RoutineTaskListResponseDto,
  RoutineTaskReorderCommand,
  RoutineTaskReorderResultDto,
  RoutineTaskUpdateCommand
} from "@/types"
import {
  ConflictError,
  mapSupabaseError,
  NotFoundError,
  ValidationError
} from "../_lib/errors"

type Client = SupabaseClient<Database>

type RoutineTaskRow = Database["public"]["Tables"]["routine_tasks"]["Row"]
type RoutineTaskInsert = Database["public"]["Tables"]["routine_tasks"]["Insert"]
type RoutineTaskUpdate = Database["public"]["Tables"]["routine_tasks"]["Update"]

function mapTask(row: RoutineTaskRow): RoutineTaskDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    points: row.points,
    position: row.position,
    isOptional: row.is_optional,
    isActive: row.is_active,
    expectedDurationSeconds: row.expected_duration_seconds
  }
}

export async function listRoutineTasks(
  client: Client,
  routineId: string,
  childProfileId: string,
  options: { includeInactive: boolean; sort: "position" | "created_at"; order: "asc" | "desc" }
): Promise<RoutineTaskListResponseDto> {
  const query = client
    .from("routine_tasks")
    .select(
      `id, name, description, points, position, is_optional, is_active, expected_duration_seconds, deleted_at`
    )
    .eq("routine_id", routineId)
    .eq("child_profile_id", childProfileId)
    .order(options.sort, { ascending: options.order === "asc" })

  if (!options.includeInactive) {
    query.eq("is_active", true).is("deleted_at", null)
  }

  const { data, error } = await query

  if (error) {
    throw mapSupabaseError(error)
  }

  return {
    data: (data as RoutineTaskRow[]).map(mapTask)
  }
}

export async function createRoutineTask(
  client: Client,
  routineId: string,
  childProfileId: string,
  command: RoutineTaskCreateCommand
): Promise<RoutineTaskDto> {
  const payload: RoutineTaskInsert = {
    routine_id: routineId,
    child_profile_id: childProfileId,
    name: command.name,
    description: command.description ?? null,
    points: command.points ?? 0,
    position: command.position,
    is_optional: command.isOptional ?? false,
    expected_duration_seconds: command.expectedDurationSeconds ?? null,
    is_active: true
  }

  const { data, error } = await client
    .from("routine_tasks")
    .insert(payload)
    .select("*")
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  if (!data) {
    throw new NotFoundError("Failed to create routine task")
  }

  return mapTask(data as RoutineTaskRow)
}

export async function getRoutineTaskById(
  client: Client,
  taskId: string
): Promise<RoutineTaskRow> {
  const { data, error } = await client
    .from("routine_tasks")
    .select("*")
    .eq("id", taskId)
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  if (!data || data.deleted_at) {
    throw new NotFoundError("Routine task not found")
  }

  return data
}

function buildTaskUpdatePayload(
  command: RoutineTaskUpdateCommand
): RoutineTaskUpdate {
  const payload: RoutineTaskUpdate = {}

  if (typeof command.name !== "undefined") {
    payload.name = command.name
  }

  if (typeof command.description !== "undefined") {
    payload.description = command.description
  }

  if (typeof command.points !== "undefined") {
    payload.points = command.points
  }

  if (typeof command.position !== "undefined") {
    payload.position = command.position
  }

  if (typeof command.isOptional !== "undefined") {
    payload.is_optional = command.isOptional
  }

  if (typeof command.isActive !== "undefined") {
    payload.is_active = command.isActive
  }

  if (typeof command.expectedDurationSeconds !== "undefined") {
    payload.expected_duration_seconds = command.expectedDurationSeconds
  }

  if (typeof command.deletedAt !== "undefined") {
    payload.deleted_at = command.deletedAt
  }

  if (Object.keys(payload).length > 0) {
    payload.updated_at = new Date().toISOString()
  }

  return payload
}

export async function updateRoutineTask(
  client: Client,
  taskId: string,
  command: RoutineTaskUpdateCommand
): Promise<RoutineTaskDto> {
  await getRoutineTaskById(client, taskId)

  const payload = buildTaskUpdatePayload(command)

  const { data, error } = await client
    .from("routine_tasks")
    .update(payload)
    .eq("id", taskId)
    .select("*")
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  if (!data) {
    throw new NotFoundError("Routine task not found")
  }

  return mapTask(data as RoutineTaskRow)
}

export async function reorderRoutineTasks(
  client: Client,
  command: RoutineTaskReorderCommand
): Promise<RoutineTaskReorderResultDto> {
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
      .from("routine_tasks")
      .update({
        position: entry.position,
        updated_at: new Date().toISOString()
      })
      .eq("id", entry.taskId)
      .eq("routine_id", command.routineId)
      .eq("child_profile_id", command.childProfileId)
      .select("id")
  )

  const results = await Promise.all(updates)

  for (const result of results) {
    if (result.error) {
      throw mapSupabaseError(result.error)
    }

    if (!result.data || result.data.length === 0) {
      throw new ConflictError("Task reorder failed")
    }
  }

  return { message: "Tasks reordered" }
}
