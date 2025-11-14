import { addDays, startOfDay } from "date-fns"
import type { Database } from "@/db/database.types"
import type { createSupabaseServerClient } from "@/lib/supabase"
import { getSessionDetails } from "@/app/api/_services/routineSessionsService"
import { listChildAchievements } from "@/app/api/_services/achievementsService"
import { listRoutinePerformance } from "@/app/api/_services/performanceService"
import { getChildWallet } from "@/app/api/_services/walletService"
import {
  ChildAchievementViewModel,
  ChildProfileSnapshot,
  ChildRewardViewModel,
  ChildRewardsSnapshot,
  ChildRoutineBoardData,
  ChildRoutineHistoryItem,
  ChildRoutinePreview,
  ChildRoutineSessionViewModel,
  ChildRoutineTask,
  ChildRoutineSuccessSummary,
} from "./types"

type AppSupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>

const DEFAULT_BOARD_DAYS_AHEAD = 7

type RoutineAssignmentRow = {
  routine_id: string
  deleted_at: string | null
  is_enabled: boolean
  routine: {
    id: string
    name: string
    routine_type: string | null
    start_time: string | null
    end_time: string | null
    auto_close_after_minutes: number | null
    is_active: boolean
    settings: Record<string, unknown> | null
  } | null
}

type RoutineTaskRow = {
  routine_id: string
  points: number | null
}

type RoutineSessionRow = {
  id: string
  routine_id: string
  session_date: string
  status: Database["public"]["Enums"]["routine_session_status"]
  started_at: string | null
  planned_end_at: string | null
  completed_at: string | null
  points_awarded: number | null
  created_at: string
  duration_seconds: number | null
  best_time_beaten: boolean | null
}

type RoutineSessionInsert = Database["public"]["Tables"]["routine_sessions"]["Insert"]

type RoutineTaskDetailRow = {
  id: string
  name: string
  description: string | null
  points: number | null
  expected_duration_seconds: number | null
  is_optional: boolean
  position: number
}

type RoutineRow = {
  id: string
  name: string
  start_time: string | null
  end_time: string | null
}

type ProfileWithFamilyRow = {
  families: {
    timezone: string | null
  } | null
}

type RewardRow = {
  id: string
  name: string
  description: string | null
  cost_points: number
  is_active: boolean
  is_repeatable: boolean
  settings: Record<string, unknown> | null
}

type HistoryRow = {
  id: string
  routine_id: string
  completed_at: string | null
  points_awarded: number | null
  routines: {
    name: string
  } | null
}

function combineDateAndTime(date: string, time: string | null): string | null {
  if (!time) {
    return null
  }
  return `${date}T${time}`
}

const DEFAULT_FAMILY_TIMEZONE = "Europe/Warsaw"

function formatDateInTimezone(date: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date)

    const year = parts.find((part) => part.type === "year")?.value
    const month = parts.find((part) => part.type === "month")?.value
    const day = parts.find((part) => part.type === "day")?.value

    if (year && month && day) {
      return `${year}-${month}-${day}`
    }
  } catch (error) {
    console.warn("[child:formatDateInTimezone] Failed to format date", {
      error,
      timeZone,
    })
  }

  return date.toISOString().slice(0, 10)
}

async function resolveChildTimezone(client: AppSupabaseClient, childProfileId: string): Promise<string> {
  const { data, error } = await client
    .from("profiles")
    .select("families(timezone)")
    .eq("id", childProfileId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  const row = data as ProfileWithFamilyRow | null
  const timezone = row?.families?.timezone

  if (typeof timezone === "string" && timezone.length > 0) {
    return timezone
  }

  return DEFAULT_FAMILY_TIMEZONE
}

function parseSettings(settings: Record<string, unknown> | null): {
  imageUrl: string | null
  source?: "template" | "custom"
} {
  if (!settings) {
    return { imageUrl: null }
  }

  const imageUrl = typeof settings.imageUrl === "string" ? settings.imageUrl : null
  const templateId = typeof settings.templateId === "string" ? settings.templateId : null
  const source =
    templateId !== null
      ? "template"
      : settings.source === "custom"
        ? "custom"
        : undefined

  return { imageUrl, source }
}

function sortByStartTime(a: ChildRoutinePreview, b: ChildRoutinePreview): number {
  if (a.startAt && b.startAt) {
    return a.startAt.localeCompare(b.startAt)
  }
  if (a.startAt) return -1
  if (b.startAt) return 1
  return a.name.localeCompare(b.name)
}

function sortHistory(a: ChildRoutineHistoryItem, b: ChildRoutineHistoryItem): number {
  return b.completedAt.localeCompare(a.completedAt)
}

async function ensureRoutineSessionsForAssignments(
  client: AppSupabaseClient,
  childProfileId: string,
  routineMap: Map<string, RoutineAssignmentRow["routine"]>,
  todayDate: string
): Promise<void> {
  if (routineMap.size === 0) {
    return
  }

  const routineIds = Array.from(routineMap.keys())

  const { data: existingSessions, error: existingSessionsError } = await client
    .from("routine_sessions")
    .select("routine_id, session_date")
    .eq("child_profile_id", childProfileId)
    .gte("session_date", todayDate)
    .in("routine_id", routineIds)

  if (existingSessionsError) {
    throw new Error(existingSessionsError.message)
  }

  const routinesWithUpcomingSession = new Set<string>()
  ;(existingSessions ?? []).forEach((row) => {
    if (routineMap.has(row.routine_id)) {
      routinesWithUpcomingSession.add(row.routine_id)
    }
  })

  const missingRoutineIds = routineIds.filter((id) => !routinesWithUpcomingSession.has(id))

  if (missingRoutineIds.length === 0) {
    return
  }

  const inserts: RoutineSessionInsert[] = missingRoutineIds.map((routineId) => {
    const routine = routineMap.get(routineId)
    return {
      routine_id: routineId,
      child_profile_id: childProfileId,
      session_date: todayDate,
      planned_end_at: combineDateAndTime(todayDate, routine?.end_time ?? null),
      status: "scheduled",
    }
  })

  const { error: insertError } = await client.from("routine_sessions").insert(inserts)
  if (insertError) {
    throw new Error(insertError.message)
  }
}

export async function fetchChildRoutineBoard(
  client: AppSupabaseClient,
  childProfileId: string,
  options: { daysAhead?: number } = {}
): Promise<ChildRoutineBoardData> {
  const timezone = await resolveChildTimezone(client, childProfileId)
  const today = new Date()
  const todayDate = formatDateInTimezone(today, timezone)
  const limitDate = formatDateInTimezone(
    addDays(today, options.daysAhead ?? DEFAULT_BOARD_DAYS_AHEAD),
    timezone
  )

  const { data: assignmentsData, error: assignmentsError } = await client
    .from("child_routines")
    .select(
      `
        routine_id,
        deleted_at,
        is_enabled,
        routine:routines (
          id,
          name,
          routine_type,
          start_time,
          end_time,
          auto_close_after_minutes,
          is_active,
          settings
        )
      `
    )
    .eq("child_profile_id", childProfileId)
    .is("deleted_at", null)
    .order("position", { ascending: true })

  if (assignmentsError) {
    throw new Error(assignmentsError.message)
  }

  const assignments = (assignmentsData ?? []) as RoutineAssignmentRow[]
  const routineMap = new Map<string, RoutineAssignmentRow["routine"]>()

  assignments.forEach((assignment) => {
    if (assignment.is_enabled && assignment.routine?.is_active) {
      routineMap.set(assignment.routine_id, assignment.routine)
    }
  })

  if (routineMap.size === 0) {
    return { today: [], upcoming: [], completed: [] }
  }

  const { data: taskTotalsData, error: taskTotalsError } = await client
    .from("routine_tasks")
    .select("routine_id, points")
    .eq("child_profile_id", childProfileId)
    .eq("is_active", true)
    .is("deleted_at", null)

  if (taskTotalsError) {
    throw new Error(taskTotalsError.message)
  }

  const taskTotals = new Map<string, number>();
  (taskTotalsData ?? []).forEach((row) => {
    const typed = row as RoutineTaskRow
    const current = taskTotals.get(typed.routine_id) ?? 0
    taskTotals.set(typed.routine_id, current + (typed.points ?? 0))
  })

  async function loadSessions(): Promise<RoutineSessionRow[]> {
    const { data, error } = await client
      .from("routine_sessions")
      .select("id, routine_id, session_date, status, started_at, planned_end_at, completed_at, points_awarded, created_at, best_time_beaten")
      .eq("child_profile_id", childProfileId)
      .gte("session_date", todayDate)
      .lte("session_date", limitDate)

    if (error) {
      throw new Error(error.message)
    }

    return (data ?? []) as RoutineSessionRow[]
  }

  let sessionData = await loadSessions()

  const hasAssignments = routineMap.size > 0
  if (hasAssignments) {
    const routinesRepresented = new Set<string>()
    sessionData.forEach((session) => {
      if (routineMap.has(session.routine_id)) {
        routinesRepresented.add(session.routine_id)
      }
    })

    if (routinesRepresented.size < routineMap.size) {
      await ensureRoutineSessionsForAssignments(client, childProfileId, routineMap, todayDate)
      sessionData = await loadSessions()
    }
  }

  const board: ChildRoutineBoardData = { today: [], upcoming: [], completed: [] }

  const activeStatuses = new Set<Database["public"]["Enums"]["routine_session_status"]>([
    "scheduled",
    "in_progress",
  ])

  const completedStatuses = new Set<Database["public"]["Enums"]["routine_session_status"]>([
    "completed",
    "auto_closed",
    "expired",
    "skipped",
  ])

  ;(sessionData ?? [])
    .filter((session) => routineMap.has(session.routine_id))
    .sort((a, b) => {
      const byDate = a.session_date.localeCompare(b.session_date)
      if (byDate !== 0) return byDate
      return (a.created_at ?? "").localeCompare(b.created_at ?? "")
    })
    .forEach((session) => {
      const routine = routineMap.get(session.routine_id)
      if (!routine) return

      const startAt = combineDateAndTime(session.session_date, routine.start_time) ?? session.started_at
      const endAt = combineDateAndTime(session.session_date, routine.end_time) ?? session.planned_end_at ?? null
      const basePoints = taskTotals.get(session.routine_id) ?? 0
      const preview: ChildRoutinePreview = {
        sessionId: session.id,
        routineId: session.routine_id,
        name: routine.name ?? "Rutyna",
        status: "today",
        startAt,
        endAt,
        pointsAvailable:
          session.status === "completed" && typeof session.points_awarded === "number" && session.points_awarded > 0
            ? session.points_awarded
            : basePoints,
      }

      if (session.session_date === todayDate) {
        if (completedStatuses.has(session.status)) {
          preview.status = "completed"
          board.completed.push(preview)
        } else if (activeStatuses.has(session.status)) {
          preview.status = "today"
          board.today.push(preview)
        }
      } else if (session.session_date > todayDate) {
        if (completedStatuses.has(session.status)) {
          preview.status = "completed"
          board.completed.push(preview)
        } else {
          preview.status = "upcoming"
          board.upcoming.push(preview)
        }
      }
    })

  board.today.sort(sortByStartTime)
  board.upcoming.sort(sortByStartTime)
  board.completed.sort(sortByStartTime)

  return board
}

export async function fetchChildRoutineSessionViewModel(
  client: AppSupabaseClient,
  sessionId: string
): Promise<ChildRoutineSessionViewModel> {
  const details = await getSessionDetails(client, sessionId)

  const { data: routineData, error: routineError } = await client
    .from("routines")
    .select("id, name, start_time, end_time")
    .eq("id", details.routineId)
    .maybeSingle()

  if (routineError) {
    throw new Error(routineError.message)
  }

  const routine = (routineData ?? null) as RoutineRow | null
  const { data: taskRows, error: taskError } = await client
    .from("routine_tasks")
    .select("id, name, description, points, expected_duration_seconds, is_optional, position")
    .eq("routine_id", details.routineId)
    .eq("child_profile_id", details.childProfileId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("position", { ascending: true })

  if (taskError) {
    throw new Error(taskError.message)
  }

  const completionStatuses = new Map(details.tasks?.map((task) => [task.taskId, task.status]) ?? [])
  const steps = (taskRows ?? []).map((row) => {
    const task = row as RoutineTaskDetailRow
    const status = completionStatuses.get(task.id) ?? "pending"
    return {
      id: task.id,
      title: task.name,
      description: task.description,
      points: task.points ?? 0,
      durationSeconds: task.expected_duration_seconds ?? null,
      isOptional: task.is_optional,
      status,
    }
  })

  const totalPoints = steps.reduce((acc, step) => acc + step.points, 0)

  return {
    id: details.id,
    routineId: details.routineId,
    childProfileId: details.childProfileId,
    routineName: routine?.name ?? "Rutyna",
    sessionDate: details.sessionDate,
    status: details.status,
    startedAt: details.startedAt,
    plannedEndAt: details.plannedEndAt ?? combineDateAndTime(details.sessionDate, routine?.end_time ?? null),
    completedAt: details.completedAt ?? null,
    durationSeconds: details.durationSeconds ?? null,
    bestTimeBeaten: details.bestTimeBeaten ?? false,
    totalPoints,
    pointsAwarded: details.pointsAwarded ?? 0,
    steps,
  }
}

export async function fetchChildRoutineSessionViewModelForChild(
  client: AppSupabaseClient,
  sessionId: string,
  childProfileId: string
): Promise<ChildRoutineSessionViewModel | null> {
  const { data: sessionRow, error: sessionError } = await client
    .from("routine_sessions")
    .select(
      "id, routine_id, child_profile_id, session_date, status, started_at, planned_end_at, completed_at, duration_seconds, points_awarded, best_time_beaten"
    )
    .eq("id", sessionId)
    .eq("child_profile_id", childProfileId)
    .maybeSingle()

  if (sessionError) {
    throw new Error(sessionError.message)
  }

  if (!sessionRow) {
    return null
  }

  const { data: routineRow, error: routineError } = await client
    .from("routines")
    .select("id, name, start_time, end_time")
    .eq("id", sessionRow.routine_id)
    .maybeSingle<RoutineRow>()

  if (routineError) {
    throw new Error(routineError.message)
  }

  const { data: taskRows, error: taskError } = await client
    .from("routine_tasks")
    .select("id, name, description, points, expected_duration_seconds, is_optional, position")
    .eq("routine_id", sessionRow.routine_id)
    .eq("child_profile_id", childProfileId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("position", { ascending: true })

  if (taskError) {
    throw new Error(taskError.message)
  }

  const { data: completionRows, error: completionError } = await client
    .from("task_completions")
    .select("routine_task_id")
    .eq("routine_session_id", sessionId)

  if (completionError) {
    throw new Error(completionError.message)
  }

  const completedTaskIds = new Set((completionRows ?? []).map((row) => row.routine_task_id as string))

  const steps = (taskRows ?? []).map((row) => {
    const task = row as RoutineTaskDetailRow
    const status: ChildRoutineTask["status"] = completedTaskIds.has(task.id) ? "completed" : "pending"
    return {
      id: task.id,
      title: task.name,
      description: task.description,
      points: task.points ?? 0,
      durationSeconds: task.expected_duration_seconds ?? null,
      isOptional: task.is_optional,
      status,
    }
  })

  const totalPoints = steps.reduce((sum, task) => sum + task.points, 0)

  return {
    id: sessionRow.id,
    routineId: sessionRow.routine_id,
    childProfileId: sessionRow.child_profile_id,
    routineName: (routineRow ?? null)?.name ?? "Rutyna",
    sessionDate: sessionRow.session_date,
    status: sessionRow.status,
    startedAt: sessionRow.started_at,
    plannedEndAt:
      sessionRow.planned_end_at ?? combineDateAndTime(sessionRow.session_date, (routineRow ?? null)?.end_time ?? null),
    completedAt: sessionRow.completed_at,
    durationSeconds: sessionRow.duration_seconds,
    bestTimeBeaten: sessionRow.best_time_beaten ?? false,
    totalPoints,
    pointsAwarded: sessionRow.points_awarded ?? 0,
    steps,
  }
}

export async function fetchChildRoutineSuccessSummary(
  client: AppSupabaseClient,
  sessionId: string,
  sessionOverride?: ChildRoutineSessionViewModel
): Promise<ChildRoutineSuccessSummary> {
  const session = sessionOverride ?? (await fetchChildRoutineSessionViewModel(client, sessionId))

  const performance = await listRoutinePerformance(client, session.childProfileId, session.routineId)
  const performanceEntry = performance.data[0]
  const bestDurationSeconds = performanceEntry?.bestDurationSeconds ?? null

  let pointsRecord: number | undefined
  if (performanceEntry?.bestSessionId) {
    const { data: bestSessionRow, error: bestSessionError } = await client
      .from("routine_sessions")
      .select("points_awarded")
      .eq("id", performanceEntry.bestSessionId)
      .maybeSingle()

    if (bestSessionError) {
      throw new Error(bestSessionError.message)
    }

    if (bestSessionRow && typeof bestSessionRow.points_awarded === "number") {
      pointsRecord = bestSessionRow.points_awarded
    }
  }

  const achievements = await listChildAchievements(client, session.childProfileId)
  const completionDate = session.completedAt ? new Date(session.completedAt) : null
  const badges: ChildAchievementViewModel[] = []

  if (completionDate) {
    const start = startOfDay(completionDate)
    const end = addDays(start, 1)
    achievements.data
      .filter((item) => {
        const awardedAt = new Date(item.awardedAt)
        return awardedAt >= start && awardedAt < end
      })
      .slice(0, 4)
      .forEach((item) => {
        badges.push({
          id: item.achievementId,
          name: item.name ?? item.code,
          description: item.description,
          unlockedAt: item.awardedAt,
          iconUrl: item.iconUrl ?? null,
        })
      })
  }

  if (badges.length === 0) {
    achievements.data.slice(0, 2).forEach((item) => {
      badges.push({
        id: item.achievementId,
        name: item.name ?? item.code,
        description: item.description,
        unlockedAt: item.awardedAt,
        iconUrl: item.iconUrl ?? null,
      })
    })
  }

  const { data: nextSessionRow, error: nextSessionError } = await client
    .from("routine_sessions")
    .select("id, routine_id, session_date, status, routines:routines(name, start_time)")
    .eq("child_profile_id", session.childProfileId)
    .gt("session_date", session.sessionDate)
    .in("status", ["scheduled", "in_progress"])
    .order("session_date", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (nextSessionError) {
    throw new Error(nextSessionError.message)
  }

  let nextRoutine: ChildRoutineSuccessSummary["nextRoutine"]
  if (nextSessionRow) {
    const startTime = nextSessionRow.routines?.start_time ?? null
    const nextStart = combineDateAndTime(nextSessionRow.session_date, startTime)
    nextRoutine = {
      sessionId: nextSessionRow.id,
      name: nextSessionRow.routines?.name ?? "Kolejna rutyna",
      startAt: nextStart,
    }
  }

  const totalTimeMinutes =
    session.durationSeconds && session.durationSeconds > 0 ? Math.max(1, Math.round(session.durationSeconds / 60)) : 0

  let previousBestDurationSeconds: number | null = null

  if (session.bestTimeBeaten) {
    const { data: previousBestRow } = await client
      .from("routine_sessions")
      .select("duration_seconds")
      .eq("child_profile_id", session.childProfileId)
      .eq("routine_id", session.routineId)
      .eq("status", "completed")
      .neq("id", session.id)
      .gt("duration_seconds", 0)
      .order("duration_seconds", { ascending: true })
      .limit(1)
      .maybeSingle<{ duration_seconds: number | null }>()

    previousBestDurationSeconds = previousBestRow?.duration_seconds ?? null
  } else {
    previousBestDurationSeconds = performanceEntry?.bestDurationSeconds ?? null
  }

  return {
    routineName: session.routineName,
    totalTimeMinutes,
    totalDurationSeconds: session.durationSeconds ?? null,
    pointsEarned: session.pointsAwarded,
    pointsRecord,
    bestDurationSeconds,
    previousBestDurationSeconds,
    bestTimeBeaten: session.bestTimeBeaten,
    badgesUnlocked: badges,
    nextRoutine,
  }
}

export async function fetchChildRewardsSnapshot(
  client: AppSupabaseClient,
  familyId: string,
  childProfileId: string
): Promise<ChildRewardsSnapshot> {
  const wallet = await getChildWallet(client, familyId, childProfileId, 5)

  const { data: rewardsData, error: rewardsError } = await client
    .from("rewards")
    .select("id, name, description, cost_points, is_active, is_repeatable, settings")
    .eq("family_id", familyId)
    .is("deleted_at", null)
    .order("name", { ascending: true })

  if (rewardsError) {
    throw new Error(rewardsError.message)
  }

  const rewards: ChildRewardViewModel[] = (rewardsData ?? []).map((row) => {
    const typed = row as RewardRow
    const { imageUrl, source } = parseSettings(typed.settings ?? null)
    return {
      id: typed.id,
      name: typed.name,
      description: typed.description,
      costPoints: typed.cost_points,
      imageUrl,
      source,
      isActive: typed.is_active,
      isRepeatable: typed.is_repeatable,
    }
  })

  return {
    balance: wallet.balance,
    rewards,
  }
}

export async function fetchChildProfileSnapshot(
  client: AppSupabaseClient,
  familyId: string,
  childProfileId: string
): Promise<ChildProfileSnapshot> {
  const wallet = await getChildWallet(client, familyId, childProfileId, 6)
  const achievements = await listChildAchievements(client, childProfileId)
  const performance = await listRoutinePerformance(client, childProfileId)

  const { data: historyData, error: historyError } = await client
    .from("routine_sessions")
    .select("id, routine_id, completed_at, points_awarded, routines:routines!inner(name)")
    .eq("child_profile_id", childProfileId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(6)

  if (historyError) {
    throw new Error(historyError.message)
  }

  const history: ChildRoutineHistoryItem[] = (historyData ?? [])
    .map((row) => row as HistoryRow)
    .filter((row) => row.completed_at)
    .map((row) => ({
      id: row.id,
      name: row.routines?.name ?? "Rutyna",
      completedAt: row.completed_at ?? "",
      pointsEarned: row.points_awarded ?? 0,
    }))
    .sort(sortHistory)

  const achievementItems: ChildAchievementViewModel[] = achievements.data
    .sort((a, b) => b.awardedAt.localeCompare(a.awardedAt))
    .map((achievement) => ({
      id: achievement.achievementId,
      name: achievement.name ?? achievement.code,
      description: achievement.description,
      unlockedAt: achievement.awardedAt,
      iconUrl: achievement.iconUrl ?? null,
    }))

  const streakDays = performance.data.reduce<number>((max, stat) => {
    const next = stat.streakDays ?? 0
    return next > max ? next : max
  }, 0)

  return {
    streakDays,
    totalPoints: wallet.balance,
    achievements: achievementItems,
    routineHistory: history,
  }
}
