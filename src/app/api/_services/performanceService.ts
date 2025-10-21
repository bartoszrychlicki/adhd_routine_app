import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/db/database.types"
import type {
  RoutinePerformanceListResponseDto,
  RoutinePerformanceStatDto
} from "@/types"
import { mapSupabaseError } from "../_lib/errors"

type Client = SupabaseClient<Database>

type PerformanceRow = Database["public"]["Tables"]["routine_performance_stats"]["Row"]

function mapPerformance(row: PerformanceRow): RoutinePerformanceStatDto {
  return {
    routineId: row.routine_id,
    childProfileId: row.child_profile_id,
    bestDurationSeconds: row.best_duration_seconds,
    bestSessionId: row.best_session_id,
    lastCompletedSessionId: row.last_completed_session_id,
    lastCompletedAt: row.last_completed_at,
    streakDays: row.streak_days,
    updatedAt: row.updated_at
  }
}

export async function listRoutinePerformance(
  client: Client,
  childProfileId: string,
  routineId?: string
): Promise<RoutinePerformanceListResponseDto> {
  const query = client
    .from("routine_performance_stats")
    .select("*")
    .eq("child_profile_id", childProfileId)
    .order("updated_at", { ascending: false })

  if (routineId) {
    query.eq("routine_id", routineId)
  }

  const { data, error } = await query

  if (error) {
    throw mapSupabaseError(error)
  }

  return {
    data: data.map((row) => mapPerformance(row as PerformanceRow))
  }
}
