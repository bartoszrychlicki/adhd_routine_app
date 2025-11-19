import type { Database } from "@/db/database.types"
import type {
  FamilyProgressChildSummaryDto,
  FamilyProgressHistoryListDto,
  FamilyProgressRoutineSummaryDto,
  FamilyProgressSummaryDto,
  FamilyProgressTaskSummaryDto
} from "@/types"
import { mapSupabaseError } from "../_lib/errors"
import type { AppSupabaseClient } from "../_lib/types"

type Client = AppSupabaseClient

async function fetchFamilyRoutineNames(
  client: Client,
  familyId: string
): Promise<Map<string, string>> {
  const { data, error } = await client
    .from("routines")
    .select("id, name")
    .eq("family_id", familyId)
    .is("deleted_at", null)

  if (error) {
    throw mapSupabaseError(error)
  }

  const map = new Map<string, string>()
  data.forEach((row) => map.set(row.id, row.name))
  return map
}

async function fetchDailySessions(
  client: Client,
  routineIds: string[],
  date: string
): Promise<Database["public"]["Tables"]["routine_sessions"]["Row"][]> {
  if (!routineIds.length) {
    return []
  }

  const { data, error } = await client
    .from("routine_sessions")
    .select("*")
    .eq("session_date", date)
    .in("routine_id", routineIds)

  if (error) {
    throw mapSupabaseError(error)
  }

  return data
}

async function fetchTasksForSessions(
  client: Client,
  sessions: Database["public"]["Tables"]["routine_sessions"]["Row"][]
): Promise<Map<string, FamilyProgressChildSummaryDto["tasks"]>> {
  const sessionIds = sessions.map((session) => session.id)
  if (sessionIds.length === 0) {
    return new Map()
  }

  const { data: taskRows, error: taskError } = await client
    .from("routine_tasks")
    .select("id, routine_id, child_profile_id, name")
    .in("routine_id", sessions.map((session) => session.routine_id))
    .in("child_profile_id", sessions.map((session) => session.child_profile_id))

  if (taskError) {
    throw mapSupabaseError(taskError)
  }

  const { data: completionRows, error: completionError } = await client
    .from("task_completions")
    .select("routine_session_id, routine_task_id, completed_at")
    .in("routine_session_id", sessionIds)

  if (completionError) {
    throw mapSupabaseError(completionError)
  }

  const completionsBySession = new Map<string, Map<string, string | null>>()
  completionRows.forEach((row) => {
    if (!completionsBySession.has(row.routine_session_id)) {
      completionsBySession.set(row.routine_session_id, new Map())
    }
    completionsBySession
      .get(row.routine_session_id)!
      .set(row.routine_task_id, row.completed_at)
  })

  const tasksMap = new Map<string, FamilyProgressChildSummaryDto["tasks"]>()

  sessions.forEach((session) => {
    const taskEntries = taskRows
      .filter(
        (task) =>
          task.routine_id === session.routine_id &&
          task.child_profile_id === session.child_profile_id
      )
      .map((task) => {
        const completion = completionsBySession
          .get(session.id)
          ?.get(task.id)
        const status: FamilyProgressTaskSummaryDto["status"] = completion
          ? "completed"
          : "pending"
        return {
          taskId: task.id,
          name: task.name,
          status,
          completedAt: completion ?? undefined
        }
      })

    tasksMap.set(session.id, taskEntries)
  })

  return tasksMap
}

export async function getDailyFamilyProgress(
  client: Client,
  familyId: string,
  date: string,
  routineNames?: Map<string, string>
): Promise<FamilyProgressSummaryDto> {
  const routinesMap = routineNames ?? (await fetchFamilyRoutineNames(client, familyId))
  const routineIds = Array.from(routinesMap.keys())
  const sessions = await fetchDailySessions(client, routineIds, date)
  const tasksMap = await fetchTasksForSessions(client, sessions)

  const routines: Map<string, FamilyProgressRoutineSummaryDto> = new Map()

  sessions.forEach((session) => {
    const routineName = routinesMap.get(session.routine_id) ?? ""
    const routineEntry = routines.get(session.routine_id) ?? {
      routineId: session.routine_id,
      name: routineName,
      children: [] as FamilyProgressChildSummaryDto[]
    }

    routineEntry.children.push({
      childProfileId: session.child_profile_id,
      sessionId: session.id,
      status: session.status,
      completedAt: session.completed_at,
      durationSeconds: session.duration_seconds,
      tasks: tasksMap.get(session.id) ?? []
    })

    routines.set(session.routine_id, routineEntry)
  })

  return {
    date,
    routines: Array.from(routines.values())
  }
}

export async function getFamilyProgressHistory(
  client: Client,
  familyId: string,
  options: { page: number; pageSize: number; fromDate?: string; toDate?: string }
): Promise<FamilyProgressHistoryListDto> {
  const rangeStart = (options.page - 1) * options.pageSize
  const rangeEnd = rangeStart + options.pageSize - 1

  const routineNames = await fetchFamilyRoutineNames(client, familyId)
  const routineIds = Array.from(routineNames.keys())

  if (!routineIds.length) {
    return {
      data: [],
      meta: {
        page: options.page,
        pageSize: options.pageSize,
        total: 0
      }
    }
  }

  let query = client
    .from("routine_sessions")
    .select("session_date", { count: "exact" })
    .in("routine_id", routineIds)
    .order("session_date", { ascending: false })
    .range(rangeStart, rangeEnd)

  if (options.fromDate) {
    query = query.gte("session_date", options.fromDate)
  }

  if (options.toDate) {
    query = query.lte("session_date", options.toDate)
  }

  const { data, error, count } = await query

  if (error) {
    throw mapSupabaseError(error)
  }

  const uniqueDates = Array.from(new Set(data.map((row) => row.session_date)))

  const progressEntries = await Promise.all(
    uniqueDates.map((date) =>
      getDailyFamilyProgress(client, familyId, date, routineNames)
    )
  )

  return {
    data: progressEntries,
    meta: {
      page: options.page,
      pageSize: options.pageSize,
      total: count ?? undefined
    }
  }
}
