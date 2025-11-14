import { describe, expect, it } from "vitest"

import type { ChildRoutineBoardData, ChildRoutineSessionViewModel } from "@/lib/child/types"
import { buildChildRoutineTabsModel } from "@/app/child/routines/tab-model"

const baseSession = (overrides: Partial<ChildRoutineSessionViewModel>): ChildRoutineSessionViewModel => ({
  id: "session-1",
  routineId: "routine-1",
  childProfileId: "child-1",
  routineName: "Poranna",
  sessionDate: "2025-01-07",
  status: "scheduled",
  startedAt: null,
  plannedEndAt: null,
  completedAt: null,
  durationSeconds: null,
  bestTimeBeaten: false,
  totalPoints: 120,
  pointsAwarded: 0,
  steps: [
    {
      id: "task-1",
      title: "Mycie zębów",
      description: null,
      points: 40,
      durationSeconds: 300,
      isOptional: false,
      status: "pending",
    },
  ],
  ...overrides,
})

describe("buildChildRoutineTabsModel", () => {
  const board: ChildRoutineBoardData = {
    today: [
      {
        sessionId: "session-active",
        routineId: "routine-active",
        name: "Poranna",
        status: "today",
        startAt: "2025-01-07T06:00:00",
        endAt: "2025-01-07T07:00:00",
        pointsAvailable: 120,
      },
    ],
    upcoming: [
      {
        sessionId: "session-upcoming",
        routineId: "routine-upcoming",
        name: "Wieczorna",
        status: "upcoming",
        startAt: "2025-01-07T19:00:00",
        endAt: "2025-01-07T20:15:00",
        pointsAvailable: 90,
      },
    ],
    completed: [
      {
        sessionId: "session-completed",
        routineId: "routine-completed",
        name: "Weekendowa",
        status: "completed",
        startAt: "2025-01-06T10:00:00",
        endAt: "2025-01-06T11:00:00",
        pointsAvailable: 60,
      },
    ],
  }

  const sessions: ChildRoutineSessionViewModel[] = [
    baseSession({
      id: "session-active",
      routineId: "routine-active",
      status: "in_progress",
      startedAt: "2025-01-07T06:05:00Z",
    }),
    baseSession({
      id: "session-upcoming",
      routineId: "routine-upcoming",
      routineName: "Wieczorna",
      status: "scheduled",
      steps: [
        {
          id: "task-3",
          title: "Piżama",
          description: null,
          points: 20,
          durationSeconds: 180,
          isOptional: false,
          status: "pending",
        },
      ],
    }),
    baseSession({
      id: "session-completed",
      routineId: "routine-completed",
      routineName: "Weekendowa",
      status: "completed",
      completedAt: "2025-01-06T10:42:00Z",
      durationSeconds: 1080,
      steps: [
        {
          id: "task-4",
          title: "Porządki",
          description: null,
          points: 30,
          durationSeconds: 600,
          isOptional: false,
          status: "completed",
        },
      ],
    }),
  ]

  it("marks the first today session as active and locks other tabs when in progress", () => {
    const { tabs, activeSessionId } = buildChildRoutineTabsModel({
      board,
      sessions,
      timezone: "Europe/Warsaw",
      now: new Date("2025-01-07T06:10:00Z"),
    })

    expect(activeSessionId).toBe("session-active")
    const activeTab = tabs[0]
    expect(activeTab.id).toBe("session-active")
    expect(activeTab.isCurrent).toBe(true)
    expect(activeTab.isInProgress).toBe(true)
    expect(activeTab.mandatoryTaskIds).toContain("task-1")
    expect(activeTab.successHref).toBe("/child/routines/session-active/success")
    const upcomingTab = tabs.find((tab) => tab.id === "session-upcoming")
    expect(upcomingTab?.isLocked).toBe(true)
  })

  it("includes availability messaging and formatted points", () => {
    const { tabs } = buildChildRoutineTabsModel({
      board,
      sessions,
      timezone: "Europe/Warsaw",
      now: new Date("2025-01-07T06:10:00Z"),
    })

    const upcomingTab = tabs.find((tab) => tab.id === "session-upcoming")
    expect(upcomingTab?.badgeLabel).toContain("Wkrótce")
    expect(upcomingTab?.badgeLabel).toContain("19:00")
    expect(upcomingTab?.availabilityMessage).toBe(
      "Ta rutyna jest teraz nieaktywna. Będzie dostępna o 19:00."
    )
    expect(upcomingTab?.points).toBe(90)
  })

  it("summarises completion info for completed routines", () => {
    const now = new Date("2025-01-07T06:10:00Z")
    const { tabs } = buildChildRoutineTabsModel({
      board,
      sessions,
      timezone: "Europe/Warsaw",
      now,
    })
    const completedTab = tabs.find((tab) => tab.id === "session-completed")
    expect(completedTab?.completionSummary).toMatch(/Ostatnio ukończono/)
    expect(completedTab?.completionSummary).toMatch(/Czas wykonania: 18 min/)
    expect(completedTab?.tasks[0]?.status).toBe("completed")
    expect(completedTab?.completedTasks).toHaveLength(1)
  })

  it("downgrades secondary 'today' routines to upcoming status", () => {
    const multiBoard: ChildRoutineBoardData = {
      today: [
        {
          sessionId: "session-primary",
          routineId: "routine-primary",
          name: "Poranna",
          status: "today",
          startAt: "2025-01-07T06:00:00",
          endAt: "2025-01-07T07:00:00",
          pointsAvailable: 120,
        },
        {
          sessionId: "session-secondary",
          routineId: "routine-secondary",
          name: "Poranna 2",
          status: "today",
          startAt: "2025-01-07T18:00:00",
          endAt: "2025-01-07T22:00:00",
          pointsAvailable: 80,
        },
      ],
      upcoming: [],
      completed: [],
    }

    const multiSessions: ChildRoutineSessionViewModel[] = [
      baseSession({ id: "session-primary", routineId: "routine-primary", status: "in_progress" }),
      baseSession({
        id: "session-secondary",
        routineId: "routine-secondary",
        routineName: "Poranna 2",
        status: "scheduled",
        steps: [
          {
            id: "task-secondary",
            title: "Śniadanie",
            description: null,
            points: 20,
            durationSeconds: 300,
            isOptional: false,
            status: "pending",
          },
        ],
      }),
    ]

    const { tabs } = buildChildRoutineTabsModel({
      board: multiBoard,
      sessions: multiSessions,
      timezone: "Europe/Warsaw",
      now: new Date("2025-01-07T12:05:00Z"),
    })

    const activeTabs = tabs.filter((tab) => tab.status === "active")
    expect(activeTabs).toHaveLength(0)
    const secondary = tabs.find((tab) => tab.id === "session-secondary")
    expect(secondary?.status).toBe("upcoming")
    expect(secondary?.availabilityMessage).toBe("Ta rutyna będzie dostępna po ukończeniu aktualnej misji.")
  })

  it("keeps future window routines as upcoming", () => {
    const boardFuture: ChildRoutineBoardData = {
      today: [
        {
          sessionId: "session-future",
          routineId: "routine-future",
          name: "Wieczorna",
          status: "today",
          startAt: "2025-01-07T18:00:00",
          endAt: "2025-01-07T20:00:00",
          pointsAvailable: 90,
        },
      ],
      upcoming: [],
      completed: [],
    }

    const sessionsFuture: ChildRoutineSessionViewModel[] = [
      baseSession({
        id: "session-future",
        routineId: "routine-future",
        routineName: "Wieczorna",
        status: "scheduled",
      }),
    ]

    const { tabs, activeSessionId } = buildChildRoutineTabsModel({
      board: boardFuture,
      sessions: sessionsFuture,
      timezone: "Europe/Warsaw",
      now: new Date("2025-01-07T12:00:00Z"),
    })

    const routineTab = tabs.find((tab) => tab.id === "session-future")
    expect(activeSessionId).toBe("session-future")
    expect(routineTab?.status).toBe("upcoming")
    expect(routineTab?.availabilityMessage).toBe("Ta rutyna jest teraz nieaktywna. Będzie dostępna o 18:00.")
  })

  it("marks past window routines as upcoming with retry message", () => {
    const boardPast: ChildRoutineBoardData = {
      today: [
        {
          sessionId: "session-past",
          routineId: "routine-past",
          name: "Poranna",
          status: "today",
          startAt: "2025-01-07T06:00:00",
          endAt: "2025-01-07T07:00:00",
          pointsAvailable: 70,
        },
      ],
      upcoming: [],
      completed: [],
    }

    const sessionsPast: ChildRoutineSessionViewModel[] = [
      baseSession({
        id: "session-past",
        routineId: "routine-past",
        routineName: "Poranna",
        status: "scheduled",
      }),
    ]

    const { tabs } = buildChildRoutineTabsModel({
      board: boardPast,
      sessions: sessionsPast,
      timezone: "Europe/Warsaw",
      now: new Date("2025-01-07T12:00:00Z"),
    })

    const routineTab = tabs.find((tab) => tab.id === "session-past")
    expect(routineTab?.status).toBe("upcoming")
    expect(routineTab?.availabilityMessage).toBe(
      "Ta rutyna była dostępna do 07:00. Spróbuj ponownie przy następnym terminie."
    )
  })
})
