import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("@/app/api/_services/performanceService", () => ({
  listRoutinePerformance: vi.fn(),
}))

vi.mock("@/app/api/_services/achievementsService", () => ({
  listChildAchievements: vi.fn(),
}))

import { fetchChildRoutineSuccessSummary } from "@/lib/child/queries"
import type { ChildRoutineSessionViewModel } from "@/lib/child/types"
import { listRoutinePerformance } from "@/app/api/_services/performanceService"
import { listChildAchievements } from "@/app/api/_services/achievementsService"

const mockedListRoutinePerformance = vi.mocked(listRoutinePerformance)
const mockedListChildAchievements = vi.mocked(listChildAchievements)

type SupabaseResponse<T = unknown> = {
  data?: T
  error?: { message: string } | null
}

type SupabaseQueryBuilder = {
  select: () => SupabaseQueryBuilder
  eq: () => SupabaseQueryBuilder
  gt: () => SupabaseQueryBuilder
  in: () => SupabaseQueryBuilder
  order: () => SupabaseQueryBuilder
  limit: () => SupabaseQueryBuilder
  neq: () => SupabaseQueryBuilder
  maybeSingle: () => Promise<SupabaseResponse>
}

function createSupabaseStub(responses: Record<string, SupabaseResponse[]>): { from: (table: string) => SupabaseQueryBuilder } {
  const state = new Map<string, SupabaseResponse[]>(
    Object.entries(responses).map(([table, entries]) => [table, [...entries]])
  )

  return {
    from(table: string) {
      const chain: SupabaseQueryBuilder = {
        select: () => chain,
        eq: () => chain,
        gt: () => chain,
        in: () => chain,
        order: () => chain,
        limit: () => chain,
        neq: () => chain,
        maybeSingle: () => {
          const queue = state.get(table) ?? []
          const response = queue.shift() ?? { data: null, error: null }
          state.set(table, queue)
          return Promise.resolve(response)
        },
      }
      return chain
    },
  }
}

function buildSession(overrides: Partial<ChildRoutineSessionViewModel>): ChildRoutineSessionViewModel {
  return {
    id: "session-1",
    routineId: "routine-1",
    childProfileId: "child-1",
    routineName: "Poranna",
    sessionDate: "2025-01-01",
    status: "completed",
    startedAt: "2025-01-01T07:00:00Z",
    plannedEndAt: null,
    completedAt: "2025-01-01T07:05:00Z",
    durationSeconds: 120,
    bestTimeBeaten: false,
    totalPoints: 60,
    pointsAwarded: 80,
    steps: [],
    ...overrides,
  }
}

beforeEach(() => {
  mockedListRoutinePerformance.mockReset()
  mockedListChildAchievements.mockReset()
})

describe("fetchChildRoutineSuccessSummary", () => {
  it("returns timing context when the child beats their record", async () => {
    mockedListRoutinePerformance.mockResolvedValue({
      data: [
        {
          routineId: "routine-1",
          childProfileId: "child-1",
          bestDurationSeconds: 120,
          bestSessionId: "record-session",
          lastCompletedSessionId: "session-1",
          lastCompletedAt: "2025-01-01T07:05:00Z",
          streakDays: 3,
          updatedAt: "2025-01-01T07:05:00Z",
        },
      ],
    })
    mockedListChildAchievements.mockResolvedValue({
      data: [
        {
          achievementId: "ach-1",
          code: "speedster",
          name: "Speedster",
          description: "Finish fast",
          iconUrl: null,
          awardedAt: "2025-01-01T07:05:00Z",
          metadata: {}
        },
      ],
    })

    const supabase = createSupabaseStub({
      routine_sessions: [
        { data: { points_awarded: 95 }, error: null },
        {
          data: {
            id: "next-session",
            routine_id: "routine-1",
            session_date: "2025-01-02",
            status: "scheduled",
            routines: { name: "Popołudnie", start_time: "10:00:00" },
          },
          error: null,
        },
        { data: { duration_seconds: 150 }, error: null },
      ],
    })

    const summary = await fetchChildRoutineSuccessSummary(
      supabase as never,
      "session-1",
      buildSession({ bestTimeBeaten: true, durationSeconds: 90 })
    )

    expect(summary.bestDurationSeconds).toBe(120)
    expect(summary.previousBestDurationSeconds).toBe(150)
    expect(summary.pointsRecord).toBe(95)
    expect(summary.nextRoutine?.sessionId).toBe("next-session")
    expect(summary.badgesUnlocked).toHaveLength(1)
    expect(summary.bestTimeBeaten).toBe(true)
  })

  it("falls back to stored best duration when record is not beaten", async () => {
    mockedListRoutinePerformance.mockResolvedValue({
      data: [
        {
          routineId: "routine-1",
          childProfileId: "child-1",
          bestDurationSeconds: 140,
          bestSessionId: "record-session",
          lastCompletedSessionId: "session-9",
          lastCompletedAt: "2025-01-01T06:50:00Z",
          streakDays: 5,
          updatedAt: "2025-01-01T07:00:00Z",
        },
      ],
    })
    mockedListChildAchievements.mockResolvedValue({
      data: [
        {
          achievementId: "ach-2",
          code: "starter",
          name: "Starter",
          description: null,
          iconUrl: null,
          awardedAt: "2024-12-31T12:00:00Z",
          metadata: {}
        },
      ],
    })

    const supabase = createSupabaseStub({
      routine_sessions: [
        { data: { points_awarded: 70 }, error: null },
        { data: null, error: null },
      ],
    })

    const summary = await fetchChildRoutineSuccessSummary(
      supabase as never,
      "session-1",
      buildSession({ bestTimeBeaten: false, durationSeconds: 200 })
    )

    expect(summary.previousBestDurationSeconds).toBe(140)
    expect(summary.bestTimeBeaten).toBe(false)
    expect(summary.pointsRecord).toBe(70)
    expect(summary.nextRoutine).toBeUndefined()
    expect(summary.badgesUnlocked).toHaveLength(1)
  })
})
