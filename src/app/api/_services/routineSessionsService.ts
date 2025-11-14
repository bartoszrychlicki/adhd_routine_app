import { addMinutes, differenceInCalendarDays } from "date-fns"
import { awardAchievement } from "./achievementsService"
import type { Database, Json } from "@/db/database.types"
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
import type { AppSupabaseClient } from "../_lib/types"

type Client = AppSupabaseClient

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

async function fetchChildFamilyId(
  client: Client,
  childProfileId: string
): Promise<string> {
  const { data, error } = await client
    .from("profiles")
    .select("family_id")
    .eq("id", childProfileId)
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  if (!data?.family_id) {
    throw new NotFoundError("Child profile missing family association")
  }

  return data.family_id
}

async function fetchTaskPointsMap(
  client: Client,
  routineId: string,
  childProfileId: string
): Promise<Map<string, number>> {
  const { data, error } = await client
    .from("routine_tasks")
    .select("id, points")
    .eq("routine_id", routineId)
    .eq("child_profile_id", childProfileId)
    .eq("is_active", true)
    .is("deleted_at", null)

  if (error) {
    throw mapSupabaseError(error)
  }

  const map = new Map<string, number>()
  ;(data ?? []).forEach((row) => {
    map.set(row.id as string, Number(row.points ?? 0))
  })
  return map
}

async function fetchChildBalance(
  client: Client,
  familyId: string,
  childProfileId: string
): Promise<number> {
  const { data, error } = await client
    .from("point_transactions")
    .select("points_delta")
    .eq("family_id", familyId)
    .eq("profile_id", childProfileId)

  if (error) {
    throw mapSupabaseError(error)
  }

  return (data ?? []).reduce((total, row) => total + Number(row.points_delta ?? 0), 0)
}

async function insertPointTransaction(
  client: Client,
  familyId: string,
  childProfileId: string,
  amount: number,
  type: Database["public"]["Enums"]["point_transaction_type"],
  reason: string,
  referenceId: string,
  metadata: Record<string, unknown>,
  currentBalance: number,
  createdByProfileId?: string | null
): Promise<{ id: string; balanceAfter: number }> {
  const newBalance = currentBalance + amount
  const { data, error } = await client
    .from("point_transactions")
    .insert({
      family_id: familyId,
      profile_id: childProfileId,
      transaction_type: type,
      points_delta: amount,
      balance_after: newBalance,
      reference_id: referenceId,
      reference_table: "routine_sessions",
      metadata,
      reason,
      created_by_profile_id: createdByProfileId ?? null,
    })
    .select("id, balance_after")
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  if (!data) {
    throw new ValidationError("Failed to record point transaction")
  }

  return {
    id: data.id,
    balanceAfter: data.balance_after,
  }
}

async function findAchievementByCode(
  client: Client,
  familyId: string,
  code: string
): Promise<string | null> {
  const { data, error } = await client
    .from("achievements")
    .select("id, family_id, deleted_at")
    .eq("code", code)
    .or(`family_id.eq.${familyId},family_id.is.null`)
    .is("deleted_at", null)
    .order("family_id", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  return data?.id ?? null
}

async function awardAchievementsIfAvailable(
  client: Client,
  childProfileId: string,
  familyId: string,
  achievementCodes: Array<{ code: string; metadata?: Json }>
): Promise<void> {
  for (const entry of achievementCodes) {
    try {
      const achievementId = await findAchievementByCode(client, familyId, entry.code)
      if (!achievementId) {
        continue
      }
      await awardAchievement(client, childProfileId, {
        achievementId,
        metadata: (entry.metadata ?? {}) as Json,
      })
    } catch (error) {
      if (error instanceof ConflictError) {
        continue
      }
      console.warn("[RoutineSession] Failed to award achievement", {
        error,
        code: entry.code,
      })
    }
  }
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

  const { data: existingSession, error: existingSessionError } = await client
    .from("routine_sessions")
    .select("*")
    .eq("child_profile_id", childProfileId)
    .eq("routine_id", command.routineId)
    .eq("session_date", command.sessionDate)
    .maybeSingle()

  if (existingSessionError) {
    throw mapSupabaseError(existingSessionError)
  }

  let sessionRow: RoutineSessionRow | null = existingSession ?? null

  if (sessionRow) {
    const { data: updated, error: updateError } = await client
      .from("routine_sessions")
      .update({
        status: "in_progress",
        started_at: now.toISOString(),
        planned_end_at: plannedEndAt ?? sessionRow.planned_end_at,
        bonus_multiplier: 1,
        points_awarded: sessionRow.points_awarded ?? 0,
        auto_closed_at: null,
      })
      .eq("id", sessionRow.id)
      .select("*")
      .maybeSingle()

    if (updateError) {
      throw mapSupabaseError(updateError)
    }

    if (!updated) {
      throw new NotFoundError("Failed to update routine session")
    }

    sessionRow = updated
  } else {
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

    sessionRow = data
  }

  if (!sessionRow) {
    throw new NotFoundError("Failed to initialize routine session")
  }

  const taskOrder = await fetchTaskOrder(
    client,
    command.routineId,
    childProfileId
  )

  return {
    id: sessionRow.id,
    status: sessionRow.status,
    startedAt: sessionRow.started_at,
    plannedEndAt: sessionRow.planned_end_at,
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
    .select("routine_task_id, completed_at")
    .eq("routine_session_id", session.id)

  if (completions.error) {
    throw mapSupabaseError(completions.error)
  }

  type CompletionRow = Pick<TaskCompletionRow, "routine_task_id" | "completed_at">
  const completionRows = (completions.data ?? []) as CompletionRow[]

  const completionMap = new Map<string, CompletionRow>()
  completionRows.forEach((item) => {
    if (item.routine_task_id) {
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
): Promise<TaskCompletionRow & { awardedPoints: number }> {
  const session = await ensureSessionWritable(client, sessionId)
  const task = await getTaskContext(client, session, taskId)
  await ensureTaskOrderRespected(client, session, task)

  const { data: existing, error: existingError } = await client
    .from("task_completions")
    .select("id")
    .eq("routine_session_id", session.id)
    .eq("routine_task_id", taskId)
    .maybeSingle()

  if (existingError) {
    throw mapSupabaseError(existingError)
  }

  if (existing) {
    throw new ConflictError("Task already completed")
  }

  const awardedPoints = Number(task.points ?? 0)

  const { data, error } = await client
    .from("task_completions")
    .insert({
      routine_session_id: session.id,
      routine_task_id: taskId,
      completed_at: command.completedAt,
      position: task.position,
      points_awarded: awardedPoints,
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

  return {
    ...(data as TaskCompletionRow),
    awardedPoints,
  }
}

export async function undoTaskCompletion(
  client: Client,
  sessionId: string,
  completionId: string
): Promise<void> {
  const session = await fetchSession(client, sessionId)

  const { data, error } = await client
    .from("task_completions")
    .delete()
    .eq("id", completionId)
    .eq("routine_session_id", session.id)
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
  command: CompleteRoutineSessionCommand,
  actorProfileId?: string
): Promise<RoutineSessionCompletionDto> {
  const session = await ensureSessionWritable(client, sessionId)
  const familyId = await fetchChildFamilyId(client, session.child_profile_id)
  const taskPointsMap = await fetchTaskPointsMap(client, session.routine_id, session.child_profile_id)

  const uniqueCompletedTaskIds = new Set(command.completedTasks.map((task) => task.taskId))
  let basePoints = 0
  uniqueCompletedTaskIds.forEach((taskId) => {
    const points = taskPointsMap.get(taskId) ?? 0
    basePoints += points
  })
  const normalizedBasePoints = Math.max(0, Math.round(basePoints))

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

  const { data: previousCompletedRow, error: previousCompletedError } = await client
    .from("routine_sessions")
    .select("session_date")
    .eq("child_profile_id", session.child_profile_id)
    .eq("routine_id", session.routine_id)
    .eq("status", "completed")
    .lt("session_date", session.session_date)
    .order("session_date", { ascending: false })
    .limit(1)
    .maybeSingle<{ session_date: string }>()

  if (previousCompletedError) {
    throw mapSupabaseError(previousCompletedError)
  }

  const { data: performanceRow, error: performanceError } = await client
    .from("routine_performance_stats")
    .select("best_duration_seconds, best_session_id, streak_days")
    .eq("child_profile_id", session.child_profile_id)
    .eq("routine_id", session.routine_id)
    .maybeSingle()

  if (performanceError) {
    throw mapSupabaseError(performanceError)
  }

  const previousBest = performanceRow?.best_duration_seconds ?? null
  const hasDuration = typeof durationSeconds === "number" && durationSeconds > 0
  const currentDuration = hasDuration ? (durationSeconds as number) : null
  const bestTimeBeaten =
    currentDuration !== null && typeof previousBest === "number" && previousBest > 0
      ? currentDuration < previousBest
      : false

  const bonusMultiplier = bestTimeBeaten ? 2 : 1
  const totalPointsAwarded = normalizedBasePoints * bonusMultiplier

  const { data, error } = await client
    .from("routine_sessions")
    .update({
      status: "completed",
      completed_at: completedAtIso,
      duration_seconds: durationSeconds,
      best_time_beaten: bestTimeBeaten,
      points_awarded: totalPointsAwarded,
      bonus_multiplier: bonusMultiplier,
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

  const nowIso = new Date().toISOString()

  const previousSessionDate = previousCompletedRow?.session_date ?? null
  let streakDays = 1
  if (previousSessionDate) {
    const prevDate = new Date(previousSessionDate)
    const currentDate = new Date(session.session_date)
    const diff = differenceInCalendarDays(currentDate, prevDate)
    if (diff === 1) {
      streakDays = (performanceRow?.streak_days ?? 0) + 1
    } else if (diff === 0) {
      streakDays = performanceRow?.streak_days ?? 1
    }
  }

  const nextBestDuration =
    currentDuration !== null &&
    (previousBest === null || previousBest <= 0 || currentDuration < previousBest)
      ? currentDuration
      : previousBest

  const nextBestSessionId =
    currentDuration !== null && nextBestDuration === currentDuration
      ? session.id
      : performanceRow?.best_session_id ?? null

  const upsertPayload = {
    child_profile_id: session.child_profile_id,
    routine_id: session.routine_id,
    best_duration_seconds: nextBestDuration,
    best_session_id: nextBestSessionId,
    last_completed_session_id: session.id,
    streak_days: streakDays,
    updated_at: nowIso
  }

  const { error: upsertError } = await client
    .from("routine_performance_stats")
    .upsert(upsertPayload, { onConflict: "child_profile_id,routine_id" })

  if (upsertError) {
    throw mapSupabaseError(upsertError)
  }

  let currentBalance = await fetchChildBalance(client, familyId, session.child_profile_id)
  let baseTransactionId: string | null = null

  if (normalizedBasePoints > 0) {
    const baseTx = await insertPointTransaction(
      client,
      familyId,
      session.child_profile_id,
      normalizedBasePoints,
      "task_completion",
      `Punkty za rutynę ${session.routine_id}`,
      session.id,
      {
        routineId: session.routine_id,
        sessionDate: session.session_date,
        bonus: false,
      },
      currentBalance,
      actorProfileId
    )
    baseTransactionId = baseTx.id
    currentBalance = baseTx.balanceAfter
  }

  if (bestTimeBeaten && normalizedBasePoints > 0) {
    const bonusTx = await insertPointTransaction(
      client,
      familyId,
      session.child_profile_id,
      normalizedBasePoints,
      "routine_bonus",
      `Bonus za rekord czasowy (${session.routine_id})`,
      session.id,
      {
        routineId: session.routine_id,
        sessionDate: session.session_date,
        bonus: true,
      },
      currentBalance,
      actorProfileId
    )
    currentBalance = bonusTx.balanceAfter
  }

  const achievementsToAward: Array<{ code: string; metadata?: Record<string, unknown> }> = []
  if (!previousSessionDate) {
    achievementsToAward.push({
      code: "first_routine",
      metadata: { sessionId: session.id, routineId: session.routine_id },
    })
  }
  if (bestTimeBeaten && normalizedBasePoints > 0) {
    achievementsToAward.push({
      code: "speedster",
      metadata: {
        sessionId: session.id,
        routineId: session.routine_id,
        durationSeconds: currentDuration,
      },
    })
  }
  if (streakDays >= 3) {
    achievementsToAward.push({
      code: "streak_3",
      metadata: { sessionId: session.id, streakDays },
    })
  }
  if (streakDays >= 7) {
    achievementsToAward.push({
      code: "streak_7",
      metadata: { sessionId: session.id, streakDays },
    })
  }

  if (achievementsToAward.length > 0) {
    await awardAchievementsIfAvailable(client, session.child_profile_id, familyId, achievementsToAward)
  }

  return {
    status: data.status,
    completedAt: data.completed_at,
    durationSeconds: data.duration_seconds,
    pointsAwarded: data.points_awarded,
    bonusMultiplier: data.bonus_multiplier,
    pointTransactionId: baseTransactionId
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
