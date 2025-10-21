import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/db/database.types"
import type {
  RoutineArchiveResultDto,
  RoutineChildAssignmentDto,
  RoutineCreateCommand,
  RoutineDetailsDto,
  RoutineSummaryDto,
  RoutineUpdateCommand,
  RoutinesListResponseDto
} from "@/types"
import {
  ConflictError,
  ForbiddenError,
  mapSupabaseError,
  NotFoundError
} from "../_lib/errors"

type Client = SupabaseClient<Database>

type RoutineRow = Database["public"]["Tables"]["routines"]["Row"]
type RoutineInsert = Database["public"]["Tables"]["routines"]["Insert"]
type RoutineUpdate = Database["public"]["Tables"]["routines"]["Update"]

function mapRoutineSummary(row: RoutineRow): RoutineSummaryDto {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    routineType: row.routine_type,
    startTime: row.start_time,
    endTime: row.end_time,
    autoCloseAfterMinutes: row.auto_close_after_minutes,
    isActive: row.is_active,
    settings: row.settings,
    createdAt: row.created_at
  }
}

function mapRoutineDetails(row: RoutineRow): RoutineDetailsDto {
  return {
    ...mapRoutineSummary(row),
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    assignedChildren: undefined
  }
}

export type ListRoutinesOptions = {
  familyId: string
  routineType?: RoutineInsert["routine_type"]
  isActive?: boolean
  includeDeleted: boolean
  limit: number
  offset: number
  sort: "name" | "created_at"
  order: "asc" | "desc"
}

export async function listRoutines(
  client: Client,
  options: ListRoutinesOptions
): Promise<RoutinesListResponseDto> {
  const query = client
    .from("routines")
    .select(
      `
        id,
        name,
        slug,
        routine_type,
        start_time,
        end_time,
        auto_close_after_minutes,
        is_active,
        settings,
        created_at,
        deleted_at
      `,
      { count: "exact" }
    )
    .eq("family_id", options.familyId)
    .order(options.sort, { ascending: options.order === "asc" })
    .range(options.offset, options.offset + options.limit - 1)

  if (options.routineType) {
    query.eq("routine_type", options.routineType)
  }

  if (typeof options.isActive === "boolean") {
    query.eq("is_active", options.isActive)
  }

  if (!options.includeDeleted) {
    query.is("deleted_at", null)
  }

  const { data, error, count } = await query

  if (error) {
    throw mapSupabaseError(error)
  }

  const summaries = (data as RoutineRow[]).map(mapRoutineSummary)

  return {
    data: summaries,
    meta: {
      page: Math.floor(options.offset / options.limit) + 1,
      pageSize: options.limit,
      total: count ?? undefined
    }
  }
}

export async function createRoutine(
  client: Client,
  familyId: string,
  command: RoutineCreateCommand
): Promise<RoutineSummaryDto> {
  const { data, error } = await client
    .from("routines")
    .insert({
      family_id: familyId,
      name: command.name,
      slug: command.slug,
      routine_type: command.routineType,
      start_time: command.startTime ?? null,
      end_time: command.endTime ?? null,
      auto_close_after_minutes: command.autoCloseAfterMinutes ?? null,
      settings: command.settings ?? {}
    })
    .select("*")
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  if (!data) {
    throw new NotFoundError("Failed to create routine")
  }

  return mapRoutineSummary(data as RoutineRow)
}

async function fetchRoutineRow(
  client: Client,
  routineId: string
): Promise<RoutineRow> {
  const { data, error } = await client
    .from("routines")
    .select("*")
    .eq("id", routineId)
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  if (!data || data.deleted_at) {
    throw new NotFoundError("Routine not found")
  }

  return data
}

export async function ensureRoutineInFamily(
  client: Client,
  routineId: string,
  familyId: string
): Promise<RoutineRow> {
  const routine = await fetchRoutineRow(client, routineId)
  if (routine.family_id !== familyId) {
    throw new ForbiddenError("Routine does not belong to this family")
  }
  return routine
}

async function loadChildAssignments(
  client: Client,
  routineId: string
): Promise<RoutineChildAssignmentDto[]> {
  const { data, error } = await client
    .from("child_routines")
    .select(
      `
        child_profile_id,
        position,
        is_enabled,
        created_at,
        updated_at
      `
    )
    .eq("routine_id", routineId)
    .order("position", { ascending: true })

  if (error) {
    throw mapSupabaseError(error)
  }

  return data.map((row) => ({
    childProfileId: row.child_profile_id,
    position: row.position,
    isEnabled: row.is_enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }))
}

export async function getRoutineDetails(
  client: Client,
  routineId: string,
  options?: { includeChildren?: boolean }
): Promise<RoutineDetailsDto> {
  const routine = await fetchRoutineRow(client, routineId)
  const details = mapRoutineDetails(routine)

  if (options?.includeChildren) {
    details.assignedChildren = await loadChildAssignments(client, routineId)
  }

  return details
}

function buildRoutineUpdatePayload(
  command: RoutineUpdateCommand
): RoutineUpdate {
  const payload: RoutineUpdate = {}

  if (typeof command.name !== "undefined") {
    payload.name = command.name
  }

  if (typeof command.slug !== "undefined") {
    payload.slug = command.slug
  }

  if (typeof command.routineType !== "undefined") {
    payload.routine_type = command.routineType
  }

  if (typeof command.startTime !== "undefined") {
    payload.start_time = command.startTime
  }

  if (typeof command.endTime !== "undefined") {
    payload.end_time = command.endTime
  }

  if (typeof command.autoCloseAfterMinutes !== "undefined") {
    payload.auto_close_after_minutes = command.autoCloseAfterMinutes
  }

  if (typeof command.settings !== "undefined") {
    payload.settings = command.settings
  }

  if (typeof command.isActive !== "undefined") {
    payload.is_active = command.isActive
  }

  if (typeof command.deletedAt !== "undefined") {
    payload.deleted_at = command.deletedAt
  }

  if (Object.keys(payload).length > 0) {
    payload.updated_at = new Date().toISOString()
  }

  return payload
}

export async function updateRoutine(
  client: Client,
  routineId: string,
  command: RoutineUpdateCommand
): Promise<RoutineDetailsDto> {
  const updatePayload = buildRoutineUpdatePayload(command)

  const { data, error } = await client
    .from("routines")
    .update(updatePayload)
    .eq("id", routineId)
    .select("*")
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  if (!data) {
    throw new NotFoundError("Routine not found")
  }

  return mapRoutineDetails(data as RoutineRow)
}

export async function archiveRoutine(
  client: Client,
  routineId: string
): Promise<RoutineArchiveResultDto> {
  const { error, count } = await client
    .from("routine_sessions")
    .select("id", { head: true, count: "exact" })
    .eq("routine_id", routineId)
    .in("status", ["scheduled", "in_progress"])

  if (error) {
    throw mapSupabaseError(error)
  }

  if (typeof count === "number" && count > 0) {
    throw new ConflictError("Routine has pending sessions")
  }

  const { error: updateError } = await client
    .from("routines")
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq("id", routineId)

  if (updateError) {
    throw mapSupabaseError(updateError)
  }

  return { message: "Routine archived" }
}
