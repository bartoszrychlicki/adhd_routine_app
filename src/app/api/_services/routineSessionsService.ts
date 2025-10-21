import { addMinutes } from "date-fns"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/db/database.types"
import type {
  CompleteRoutineSessionCommand,
  RoutineSessionChildSummaryDto,
  RoutineSessionCompletionDto,
  RoutineSessionCreateCommand,
  RoutineSessionDetailsDto,
  RoutineSessionListResponseDto,
  RoutineSessionSkipCommand,
  RoutineSessionSkipResultDto,
  RoutineSessionStartDto,
  RoutineSessionSummaryDto,
  RoutineSessionTaskOrderEntryDto,
  TaskCompletionCommand
} from "@/types"
import {
  ConflictError,
  mapSupabaseError,
  NotFoundError,
  ValidationError
} from "../_lib/errors"

type Client = SupabaseClient<Database>

type RoutineSessionRow = Database["public"]["Tables"]["routine_sessions"]["Row"]
type RoutineSessionInsert = Database["public"]["Tables"]["routine_sessions"]["Insert"]
type TaskCompletionRow = Database["public"]["Tables"]["task_completions"]["Row"]

function mapSessionSummary(row: RoutineSessionRow): RoutineSessionSummaryDto {
  return {
    id: row.id,
    routineId: row.routine_id,
    sessionDate: row.session_date,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    durationSeconds: row.duration_seconds,
    pointsAwarded: row.points_awarded,
    bonusMultiplier: row.bonus_multiplier
  }
}

type ListSessionsOptions = {
  childProfileId: string
  status?: string
  fromDate?: string
  toDate?: string
  routineId?: string
  limit: number
  offset: number
  sort: "session_date" | "started_at" | "completed_at"
  order: "asc" | "desc"
}

export async function listChildSessions(
  client: Client,
  options: ListSessionsOptions
): Promise<RoutineSessionListResponseDto> {
  const query = client
    .from("routine_sessions")
    .select("*", { count: "exact" })
    .eq("child_profile_id", options.childProfileId)
    .order(options.sort, { ascending: options.order === "asc" })
    .range(options.offset, options.offset + options.limit - 1)

  if (options.status) {
    query.eq("status", options.status)
  }

  if (options.fromDate) {
    query.gte("session_date", options.fromDate)
  }

  if (options.toDate) {
    query.lte("session_date", options.toDate)
  }

  if (options.routineId) {
    query.eq("routine_id", options.routineId)
  }

  const { data, error, count } = await query

  if (error) {
    throw mapSupabaseError(error)
  }

  const sessions = (data as RoutineSessionRow[]).map(mapSessionSummary)

  return {
    data: sessions,
    meta: {
      page: Math.floor(options.offset / options.limit) + 1,
      total: count ?? undefined
    }
  }
}

async function ensureNoActiveSession(
  client: Client,
  childProfileId: string,
  routineId: string,
  sessionDate: string
): Promise<void> {
  const { count, error } = await client
    .from("routine_sessions")
    .select("id", { count: "exact", head: true })
    .eq("child_profile_id", childProfileId)
    .eq("routine_id", routineId)
    .eq("session_date", sessionDate)
    .eq("status", "in_progress")

  if (error) {
    throw mapSupabaseError(error)
  }

  if (typeof count === "number" && count > 0) {
    throw new ConflictError("Session already in progress for this day")
  }
}

async function fetchRoutineAutoClose(
  client: Client,
  routineId: string
): Promise<number | null> {
  const { data, error } = await client
    .from("routines")
    .select("auto_close_after_minutes")
    .eq("id", routineId)
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  return data?.auto_close_after_minutes ?? null
}

async function fetchTaskOrder(
  client: Client,
  routineId: string,
  childProfileId: string
): Promise<RoutineSessionTaskOrderEntryDto[]> {
  const { data, error } = await client
    .from("routine_tasks")
    .select("id, position")
    .eq("routine_id", routineId)
    .eq("child_profile_id", childProfileId)
    .is("deleted_at", null)
    .order("position", { ascending: true })

  if (error) {
    throw mapSupabaseError(error)
  }

  return data.map((row) => ({ taskId: row.id, position: row.position }))
}

export async function startRoutineSession(
  client: Client,
  childProfileId: string,
  command: RoutineSessionCreateCommand
): Promise<RoutineSessionStartDto> {
  await ensureNoActiveSession(
    client,
    childProfileId,
    command.routineId,
    command.sessionDate
  )

  const autoCloseMinutes = await fetchRoutineAutoClose(
    client,
    command.routineId
  )

  const now = new Date()
  const plannedEndAt =
    autoCloseMinutes && autoCloseMinutes > 0
      ? addMinutes(now, autoCloseMinutes).toISOString()
      : null

  const insertPayload: RoutineSessionInsert = {
    routine_id: command.routineId,
    child_profile_id: childProfileId,
    session_date: command.sessionDate,
    status: "in_progress",
    started_at: now.toISOString(),
    planned_end_at: plannedEndAt,
    bonus_multiplier: 1,
    points_awarded: 0
  }

  const { data, error } = await client
    .from("routine_sessions")
    .insert(insertPayload)
    .select("*")
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  if (!data) {
    throw new NotFoundError("Failed to create routine session")
  }

  const taskOrder = await fetchTaskOrder(
    client,
    command.routineId,
    childProfileId
  )

  return {
    id: data.id,
    status: data.status,
    startedAt: data.started_at,
    plannedEndAt: data.planned_end_at,
    taskOrder
  }
}

async function fetchSession(
  client: Client,
  sessionId: string
): Promise<RoutineSessionRow> {
  const { data, error } = await client
    .from("routine_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  if (!data) {
    throw new NotFoundError("Session not found")
  }

  return data
}

async function fetchSessionTasks(
  client: Client,
  session: RoutineSessionRow
): Promise<RoutineSessionChildSummaryDto["tasks"]> {
  const { data, error } = await client
    .from("routine_tasks")
    .select("id, name, position, is_optional")
    .eq("routine_id", session.routine_id)
    .eq("child_profile_id", session.child_profile_id)
    .is("deleted_at", null)
    .order("position", { ascending: true })

  if (error) {
    throw mapSupabaseError(error)
  }

  const completions = await client
    .from("task_completions")
    .select("routine_task_id, completed_at, deleted_at")
    .eq("routine_session_id", session.id)

  if (completions.error) {
    throw mapSupabaseError(completions.error)
  }

  const completionMap = new Map<string, TaskCompletionRow>()
  completions.data.forEach((item) => {
    if (!item.deleted_at) {
      completionMap.set(item.routine_task_id, item)
    }
  })

  return data.map((task) => {
    const completion = completionMap.get(task.id)
    return {
      taskId: task.id,
      name: task.name,
      status: completion ? "completed" : "pending",
      completedAt: completion?.completed_at
    }
  })
}

export async function getSessionDetails(
  client: Client,
  sessionId: string,
  options?: { includeTasks?: boolean; includePerformance?: boolean }
): Promise<RoutineSessionDetailsDto> {
  const session = await fetchSession(client, sessionId)

  const details: RoutineSessionDetailsDto = {
    id: session.id,
    routineId: session.routine_id,
    childProfileId: session.child_profile_id,
    sessionDate: session.session_date,
    status: session.status,
    startedAt: session.started_at,
    completedAt: session.completed_at,
    autoClosedAt: session.auto_closed_at,
    plannedEndAt: session.planned_end_at,
    durationSeconds: session.duration_seconds,
    pointsAwarded: session.points_awarded,
    bonusMultiplier: session.bonus_multiplier,
    bestTimeBeaten: session.best_time_beaten,
    completionReason: session.completion_reason,
    notes: session.notes ?? null
  }

  if (options?.includeTasks !== false) {
    details.tasks = await fetchSessionTasks(client, session)
  }

  if (options?.includePerformance !== false) {
    const { data, error } = await client
      .from("routine_performance_stats")
      .select("routine_id, child_profile_id, best_duration_seconds, best_session_id, last_completed_session_id, last_completed_at, streak_days")
      .eq("routine_id", session.routine_id)
      .eq("child_profile_id", session.child_profile_id)
      .maybeSingle()

    if (error) {
      throw mapSupabaseError(error)
    }

    if (data) {
      details.performance = {
        routineId: data.routine_id,
        childProfileId: data.child_profile_id,
        bestDurationSeconds: data.best_duration_seconds,
        bestSessionId: data.best_session_id,
        lastCompletedSessionId: data.last_completed_session_id,
        lastCompletedAt: data.last_completed_at,
        streakDays: data.streak_days,
        updatedAt: session.updated_at
      }
    }
  }

  return details
}

async function ensureSessionWritable(
  client: Client,
  sessionId: string
): Promise<RoutineSessionRow> {
  const session = await fetchSession(client, sessionId)
  if (session.status !== "in_progress") {
    throw new ConflictError("Session is not in progress")
  }
  return session
}

async function getTaskContext(
  client: Client,
  session: RoutineSessionRow,
  taskId: string
): Promise<Database["public"]["Tables"]["routine_tasks"]["Row"]> {
  const { data, error } = await client
    .from("routine_tasks")
    .select("*")
    .eq("id", taskId)
    .eq("routine_id", session.routine_id)
    .eq("child_profile_id", session.child_profile_id)
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  if (!data || data.deleted_at) {
    throw new NotFoundError("Task not found for this session")
  }

  return data
}

async function ensureTaskOrderRespected(
  client: Client,
  session: RoutineSessionRow,
  task: Database["public"]["Tables"]["routine_tasks"]["Row"]
): Promise<void> {
  const { data, error } = await client
    .from("routine_tasks")
    .select("id, is_optional")
    .eq("routine_id", session.routine_id)
    .eq("child_profile_id", session.child_profile_id)
    .lt("position", task.position)

  if (error) {
    throw mapSupabaseError(error)
  }

  if (!data.length) {
    return
  }

  const previousIds = data.map((row) => row.id)

  const { data: completions, error: completionError } = await client
    .from("task_completions")
    .select("routine_task_id")
    .eq("routine_session_id", session.id)
    .in("routine_task_id", previousIds)
    .is("deleted_at", null)

  if (completionError) {
    throw mapSupabaseError(completionError)
  }

  const completedSet = new Set(completions.map((c) => c.routine_task_id))

  for (const prev of data) {
    if (!prev.is_optional && !completedSet.has(prev.id)) {
      throw new ConflictError("Previous mandatory task not completed")
    }
  }
}

export async function completeTaskForSession(
  client: Client,
  sessionId: string,
  taskId: string,
  command: TaskCompletionCommand
): Promise<TaskCompletionRow> {
  const session = await ensureSessionWritable(client, sessionId)
  const task = await getTaskContext(client, session, taskId)
  await ensureTaskOrderRespected(client, session, task)

  const { data: existing, error: existingError } = await client
    .from("task_completions")
    .select("id")
    .eq("routine_session_id", session.id)
    .eq("routine_task_id", taskId)
    .is("deleted_at", null)
    .maybeSingle()

  if (existingError) {
    throw mapSupabaseError(existingError)
  }

  if (existing) {
    throw new ConflictError("Task already completed")
  }

  const { data, error } = await client
    .from("task_completions")
    .insert({
      routine_session_id: session.id,
      routine_task_id: taskId,
      completed_at: command.completedAt,
      position: task.position,
      metadata: command.notes ?? {}
    })
    .select("*")
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  if (!data) {
    throw new NotFoundError("Failed to record task completion")
  }

  return data
}

export async function undoTaskCompletion(
  client: Client,
  sessionId: string,
  completionId: string
): Promise<void> {
  const session = await fetchSession(client, sessionId)

  const { data, error } = await client
    .from("task_completions")
    .update({
      deleted_at: new Date().toISOString()
    })
    .eq("id", completionId)
    .eq("routine_session_id", session.id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  if (!data) {
    throw new NotFoundError("Task completion not found")
  }
}

export async function completeRoutineSession(
  client: Client,
  sessionId: string,
  command: CompleteRoutineSessionCommand
): Promise<RoutineSessionCompletionDto> {
  const session = await ensureSessionWritable(client, sessionId)

  for (const entry of command.completedTasks) {
    try {
      await completeTaskForSession(client, sessionId, entry.taskId, {
        completedAt: entry.completedAt,
        notes: undefined
      })
    } catch (error) {
      if (error instanceof ConflictError) {
        continue
      }
      throw error
    }
  }

  const completionTimes = command.completedTasks.map((task) => {
    const timestamp = Date.parse(task.completedAt)
    if (Number.isNaN(timestamp)) {
      throw new ValidationError("Invalid completedAt timestamp")
    }
    return timestamp
  })

  const completedAtIso = new Date(
    Math.max(...completionTimes, Date.now())
  ).toISOString()

  const durationSeconds = session.started_at
    ? Math.max(
        0,
        Math.round(
          (Date.parse(completedAtIso) - Date.parse(session.started_at)) /
            1000
        )
      )
    : null

  const { data, error } = await client
    .from("routine_sessions")
    .update({
      status: "completed",
      completed_at: completedAtIso,
      duration_seconds: durationSeconds,
      best_time_beaten: command.bestTimeBeaten ?? false,
      updated_at: new Date().toISOString()
    })
    .eq("id", sessionId)
    .select("*")
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  if (!data) {
    throw new NotFoundError("Session not found")
  }

  return {
    status: data.status,
    completedAt: data.completed_at,
    durationSeconds: data.duration_seconds,
    pointsAwarded: data.points_awarded,
    bonusMultiplier: data.bonus_multiplier,
    pointTransactionId: null
  }
}

export async function skipRoutineSession(
  client: Client,
  sessionId: string,
  command: RoutineSessionSkipCommand
): Promise<RoutineSessionSkipResultDto> {
  const session = await fetchSession(client, sessionId)
  if (session.status === "completed") {
    throw new ConflictError("Completed session cannot be skipped")
  }

  const { error } = await client
    .from("routine_sessions")
    .update({
      status: command.status,
      completion_reason: command.reason ?? null,
      updated_at: new Date().toISOString(),
      auto_closed_at: command.status === "expired" ? new Date().toISOString() : null
    })
    .eq("id", sessionId)

  if (error) {
    throw mapSupabaseError(error)
  }

  return {
    message: command.status === "skipped" ? "Session skipped" : "Session expired"
  }
}
