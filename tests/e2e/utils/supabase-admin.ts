import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"

import type { Database } from "../../../supabase/types/database.types"

export type SupabaseAdminClient = ReturnType<typeof createClient<Database>>

type RoutineSessionStatus = Database["public"]["Enums"]["routine_session_status"]

type CreateParentOptions = {
  email?: string
  password?: string
  displayName?: string
}

type ParentAccount = {
  userId: string
  email: string
  password: string
  familyId: string
  profileId: string
}

export type ParentAccountFixture = ParentAccount

export type ChildProfileFixture = {
  id: string
  displayName: string
}

export type ChildProfileDetails = ChildProfileFixture & {
  pin: string | null
}

export type ChildAccountFixture = {
  profileId: string
  familyId: string
  userId: string
  email: string
  password: string
  displayName: string
}

export type SupabaseSessionCookie = {
  name: string
  value: string
  options?: {
    domain?: string
    path?: string
    maxAge?: number
    sameSite?: "lax" | "strict" | "none" | "Lax" | "Strict" | "None" | true | false
    httpOnly?: boolean
    secure?: boolean
  }
}

export type ChildViewSeedResult = {
  routines: {
    today: {
      name: string
      sessionId: string
      points: number
    }
    upcoming: {
      name: string
      sessionId: string
    }
    completed: {
      name: string
      sessionId: string
      pointsAwarded: number
    }
    totals: {
      availableToday: number
      totalPointsToday: number
      completedToday: number
    }
  }
  reward: {
    id: string
    name: string
    costPoints: number
  }
  walletBalance: number
  achievement: {
    id: string
    name: string
  }
  streakDays: number
}

function getEnv(name: string): string | undefined {
  const value = process.env[name]
  return typeof value === "string" && value.length > 0 ? value : undefined
}

export function getMissingSupabaseAdminEnv(): string[] {
  const required = [
    "PLAYWRIGHT_SUPABASE_SERVICE_ROLE_KEY",
    "PLAYWRIGHT_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
  ]

  return required.filter((name) => {
    // Accept either PLAYWRIGHT_* overrides or default NEXT_PUBLIC_ / SUPABASE_ values.
    switch (name) {
      case "PLAYWRIGHT_SUPABASE_SERVICE_ROLE_KEY":
        return !getEnv("PLAYWRIGHT_SUPABASE_SERVICE_ROLE_KEY") && !getEnv("SUPABASE_SERVICE_ROLE_KEY")
      case "PLAYWRIGHT_SUPABASE_URL":
        return !getEnv("PLAYWRIGHT_SUPABASE_URL") && !getEnv("NEXT_PUBLIC_SUPABASE_URL")
      default:
        // we only report base envs if neither override nor default exists
        if (name === "SUPABASE_SERVICE_ROLE_KEY") {
          return !getEnv("PLAYWRIGHT_SUPABASE_SERVICE_ROLE_KEY") && !getEnv("SUPABASE_SERVICE_ROLE_KEY")
        }
        if (name === "NEXT_PUBLIC_SUPABASE_URL") {
          return !getEnv("PLAYWRIGHT_SUPABASE_URL") && !getEnv("NEXT_PUBLIC_SUPABASE_URL")
        }
        return false
    }
  })
}

function createAdminClient(): SupabaseAdminClient {
  const url = getEnv("PLAYWRIGHT_SUPABASE_URL") ?? getEnv("NEXT_PUBLIC_SUPABASE_URL")
  const serviceRoleKey =
    getEnv("PLAYWRIGHT_SUPABASE_SERVICE_ROLE_KEY") ?? getEnv("SUPABASE_SERVICE_ROLE_KEY")

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase service role environment variables are not set. Provide PLAYWRIGHT_SUPABASE_URL and PLAYWRIGHT_SUPABASE_SERVICE_ROLE_KEY (or reuse NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)."
    )
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

async function ensureParentResources(
  client: SupabaseAdminClient,
  userId: string,
  email: string,
  displayName: string
): Promise<{ familyId: string; profileId: string }> {
  const { data: existingProfile, error: profileError } = await client
    .from("profiles")
    .select("id, family_id")
    .eq("auth_user_id", userId)
    .maybeSingle()

  if (profileError) {
    throw profileError
  }

  if (existingProfile?.family_id) {
    return {
      familyId: existingProfile.family_id,
      profileId: existingProfile.id,
    }
  }

  const { data: family, error: familyError } = await client
    .from("families")
    .insert({
      family_name: `Rodzina ${displayName}`,
      timezone: "Europe/Warsaw",
      settings: {
        onboarding: {
          completedSteps: [],
          isComplete: false,
        },
      },
    })
    .select("id")
    .maybeSingle()

  if (familyError || !family) {
    throw familyError ?? new Error("Failed to create family")
  }

  const { data: profile, error: insertProfileError } = await client
    .from("profiles")
    .insert({
      auth_user_id: userId,
      display_name: displayName,
      email,
      family_id: family.id,
      role: "parent",
      settings: {
        onboarding: {
          completedSteps: [],
          isComplete: false,
        },
      },
    })
    .select("id")
    .maybeSingle()

  if (insertProfileError || !profile) {
    throw insertProfileError ?? new Error("Failed to create parent profile")
  }

  return {
    familyId: family.id,
    profileId: profile.id,
  }
}

export async function createParentAccount(options: CreateParentOptions = {}): Promise<ParentAccount> {
  const client = createAdminClient()
  const email =
    options.email ??
    `parent+${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}@playwright.test`
  const password = options.password ?? `Pw!${crypto.randomUUID().slice(0, 8)}`
  const displayName = options.displayName ?? "Playwright Parent"

  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: displayName,
      role: "parent",
    },
  })

  if (error || !data.user) {
    throw error ?? new Error("Failed to create Supabase parent user")
  }

  const { familyId, profileId } = await ensureParentResources(client, data.user.id, email, displayName)

  return {
    userId: data.user.id,
    email,
    password,
    familyId,
    profileId,
  }
}

export async function deleteParentAccount(account: ParentAccount): Promise<void> {
  const client = createAdminClient()

  await client.from("profiles").delete().eq("family_id", account.familyId)
  await client.from("families").delete().eq("id", account.familyId)
  await client.auth.admin.deleteUser(account.userId)
}

type CreateChildOptions = {
  displayName?: string
}

type CreateChildAccountOptions = CreateChildOptions & {
  email?: string
  password?: string
}

export async function createChildProfileForFamily(
  familyId: string,
  options: CreateChildOptions = {}
): Promise<ChildProfileFixture> {
  const client = createAdminClient()
  const displayName = options.displayName ?? `Eryk ${crypto.randomUUID().slice(0, 4)}`

  const { data, error } = await client
    .from("profiles")
    .insert({
      family_id: familyId,
      role: "child",
      display_name: displayName,
      email: null,
      settings: {},
      pin_failed_attempts: 0,
      pin_lock_expires_at: null,
    })
    .select("id, display_name")
    .maybeSingle()

  if (error || !data) {
    throw error ?? new Error("Failed to create child profile")
  }

  return {
    id: data.id,
    displayName: data.display_name ?? displayName,
  }
}

export async function createChildAccountForProfile(
  familyId: string,
  childProfile: ChildProfileFixture,
  options: CreateChildAccountOptions = {}
): Promise<ChildAccountFixture> {
  const client = createAdminClient()
  const email =
    options.email ??
    `child+${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}@playwright.test`
  const password = options.password ?? `Ch!${crypto.randomUUID().slice(0, 8)}`
  const displayName = options.displayName ?? childProfile.displayName

  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: displayName,
      role: "child",
    },
  })

  if (error || !data.user) {
    throw error ?? new Error("Failed to create Supabase child user")
  }

  try {
    const { error: updateError } = await client
      .from("profiles")
      .update({
        auth_user_id: data.user.id,
        email,
        display_name: displayName,
        role: "child",
        updated_at: new Date().toISOString(),
      })
      .eq("id", childProfile.id)
      .eq("family_id", familyId)

    if (updateError) {
      throw updateError
    }
  } catch (updateError) {
    await client.auth.admin.deleteUser(data.user.id)
    throw updateError
  }

  return {
    profileId: childProfile.id,
    familyId,
    userId: data.user.id,
    email,
    password,
    displayName,
  }
}

export async function deleteChildAccount(account: ChildAccountFixture): Promise<void> {
  const client = createAdminClient()
  await client.auth.admin.deleteUser(account.userId)
}

export async function listChildProfilesForFamily(
  familyId: string
): Promise<ChildProfileDetails[]> {
  const client = createAdminClient()
  const { data, error } = await client
    .from("profiles")
    .select("id, display_name, settings")
    .eq("family_id", familyId)
    .eq("role", "child")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })

  if (error) {
    throw error
  }

  return (
    data?.map((row) => {
      const settings = (row.settings as Record<string, unknown> | null) ?? null
      const pin =
        settings && typeof settings.pin_plain === "string" ? (settings.pin_plain as string) : null
      return {
        id: row.id,
        displayName: row.display_name ?? "Dziecko",
        pin,
      }
    }) ?? []
  )
}

export async function createSupabaseSessionCookies(
  email: string,
  password: string
): Promise<SupabaseSessionCookie[]> {
  const supabaseUrl = getEnv("PLAYWRIGHT_SUPABASE_URL") ?? getEnv("NEXT_PUBLIC_SUPABASE_URL")
  const supabaseAnonKey =
    getEnv("PLAYWRIGHT_SUPABASE_ANON_KEY") ?? getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase anonymous credentials are not set. Provide PLAYWRIGHT_SUPABASE_URL and PLAYWRIGHT_SUPABASE_ANON_KEY (or reuse NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)."
    )
  }

  const captured: SupabaseSessionCookie[] = []

  const client = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      async get() {
        return undefined
      },
      async set(name, value, options) {
        if (typeof value === "string" && value.length > 0) {
          captured.push({ name, value, options: options ?? {} })
        }
      },
      async remove() {
        // no-op: we only care about cookies being set with values
      },
    },
  })

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    throw error
  }

  if (!data.session) {
    throw new Error("Supabase login did not return a session.")
  }

  if (captured.length === 0) {
    throw new Error("Supabase login did not set authentication cookies.")
  }

  return captured
}

export async function seedChildViewData(
  familyId: string,
  childProfileId: string
): Promise<ChildViewSeedResult> {
  const client = createAdminClient()
  const toTimeComponent = (date: Date) => date.toISOString().slice(11, 19)
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const slugBase = crypto.randomUUID().replace(/-/g, "").slice(0, 8)

  const routinesInsert = [
    {
      family_id: familyId,
      name: "Poranna misja Playwrighta",
      slug: `playwright-${slugBase}-morning`,
      routine_type: "morning" as const,
      start_time: "07:30:00",
      end_time: "08:00:00",
      is_active: true,
      settings: {},
    },
    {
      family_id: familyId,
      name: "Popołudniowa przygoda",
      slug: `playwright-${slugBase}-afternoon`,
      routine_type: "afternoon" as const,
      start_time: "16:00:00",
      end_time: "16:30:00",
      is_active: true,
      settings: {},
    },
    {
      family_id: familyId,
      name: "Wieczorny chill",
      slug: `playwright-${slugBase}-evening`,
      routine_type: "evening" as const,
      start_time: "19:00:00",
      end_time: "19:40:00",
      is_active: true,
      settings: {},
    },
  ]

  const { data: routinesData, error: routinesError } = await client
    .from("routines")
    .insert(routinesInsert)
    .select("id, name, slug")

  if (routinesError) {
    throw routinesError
  }

  if (!routinesData || routinesData.length !== routinesInsert.length) {
    throw new Error("Failed to insert routines for child view seed.")
  }

  const [morningRoutine, afternoonRoutine, eveningRoutine] = routinesData as Array<{
    id: string
    name: string
  }>

  await client.from("child_routines").insert([
    {
      routine_id: morningRoutine.id,
      child_profile_id: childProfileId,
      position: 1,
      is_enabled: true,
    },
    {
      routine_id: afternoonRoutine.id,
      child_profile_id: childProfileId,
      position: 2,
      is_enabled: true,
    },
    {
      routine_id: eveningRoutine.id,
      child_profile_id: childProfileId,
      position: 3,
      is_enabled: true,
    },
  ])

  const taskTemplate = (routineId: string) => [
    {
      routine_id: routineId,
      child_profile_id: childProfileId,
      name: "Przygotuj się",
      description: "Rozpocznij zadanie z uśmiechem.",
      points: 15,
      position: 1,
      is_optional: false,
      is_active: true,
    },
    {
      routine_id: routineId,
      child_profile_id: childProfileId,
      name: "Wykonaj misję",
      description: "Wykonaj wszystkie kroki rutyny.",
      points: 20,
      position: 2,
      is_optional: false,
      is_active: true,
    },
  ]

  await client
    .from("routine_tasks")
    .insert([
      ...taskTemplate(morningRoutine.id),
      ...taskTemplate(afternoonRoutine.id),
      ...taskTemplate(eveningRoutine.id),
    ])

  const { data: sessionsData, error: sessionsError } = await client
    .from("routine_sessions")
    .insert([
      {
        routine_id: morningRoutine.id,
        child_profile_id: childProfileId,
        session_date: today,
        status: "scheduled",
        planned_end_at: `${today}T08:00:00`,
        points_awarded: 0,
      },
      {
        routine_id: afternoonRoutine.id,
        child_profile_id: childProfileId,
        session_date: tomorrow,
        status: "scheduled",
        planned_end_at: `${tomorrow}T16:30:00`,
        points_awarded: 0,
      },
      {
        routine_id: eveningRoutine.id,
        child_profile_id: childProfileId,
        session_date: today,
        status: "completed",
        completed_at: `${today}T19:35:00`,
        points_awarded: 45,
      },
    ])
    .select("id, routine_id, points_awarded")

  if (sessionsError) {
    throw sessionsError
  }

  if (!sessionsData || sessionsData.length !== 3) {
    throw new Error("Failed to insert routine sessions for child view seed.")
  }

  const sessionMap = new Map<string, { id: string; points_awarded: number | null }>()
  sessionsData.forEach((row) => {
    sessionMap.set(row.routine_id, {
      id: row.id,
      points_awarded: row.points_awarded,
    })
  })

  const activeSession = sessionMap.get(morningRoutine.id)
  if (activeSession) {
    const windowStart = new Date(now.getTime() - 5 * 60 * 1000)
    const windowEnd = new Date(now.getTime() + 25 * 60 * 1000)

    await client
      .from("routines")
      .update({
        start_time: toTimeComponent(windowStart),
        end_time: toTimeComponent(windowEnd),
      })
      .eq("id", morningRoutine.id)

    await client
      .from("routine_sessions")
      .update({
        planned_end_at: windowEnd.toISOString(),
        status: "scheduled",
        started_at: null,
        completed_at: null,
        auto_closed_at: null,
      })
      .eq("id", activeSession.id)
  }

  await client.from("routine_performance_stats").insert([
    {
      child_profile_id: childProfileId,
      routine_id: morningRoutine.id,
      streak_days: 3,
      updated_at: new Date().toISOString(),
    },
    {
      child_profile_id: childProfileId,
      routine_id: afternoonRoutine.id,
      streak_days: 2,
      updated_at: new Date().toISOString(),
    },
    {
      child_profile_id: childProfileId,
      routine_id: eveningRoutine.id,
      streak_days: 5,
      best_session_id: sessionMap.get(eveningRoutine.id)?.id ?? null,
      last_completed_session_id: sessionMap.get(eveningRoutine.id)?.id ?? null,
      updated_at: new Date().toISOString(),
    },
  ])

  const walletTransactions: Database["public"]["Tables"]["point_transactions"]["Insert"][] = [
    {
      family_id: familyId,
      profile_id: childProfileId,
      transaction_type: "task_completion",
      points_delta: 45,
      balance_after: 45,
      created_at: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      family_id: familyId,
      profile_id: childProfileId,
      transaction_type: "routine_bonus",
      points_delta: 35,
      balance_after: 80,
      created_at: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),
    },
  ]

  await client.from("point_transactions").insert(walletTransactions)

  const { data: rewardsData, error: rewardsError } = await client
    .from("rewards")
    .insert({
      family_id: familyId,
      name: "Seans filmowy",
      description: "Wieczór z ulubionym filmem.",
      cost_points: 40,
      is_repeatable: true,
      is_active: true,
      settings: { source: "custom" },
      created_by_profile_id: null,
    })
    .select("id, name, cost_points")
    .maybeSingle()

  if (rewardsError || !rewardsData) {
    throw rewardsError ?? new Error("Failed to seed rewards for child view.")
  }

  const achievementCode = `playwright-badge-${slugBase}`
  const { data: achievementData, error: achievementError } = await client
    .from("achievements")
    .insert({
      family_id: familyId,
      code: achievementCode,
      name: "Mistrz misji",
      description: "Zakończ pierwszą misję testową.",
      criteria: { type: "manual" },
      icon_url: null,
      is_active: true,
    })
    .select("id, name")
    .maybeSingle()

  if (achievementError || !achievementData) {
    throw achievementError ?? new Error("Failed to create achievement for child view.")
  }

  await client.from("user_achievements").insert({
    profile_id: childProfileId,
    achievement_id: achievementData.id,
    awarded_at: new Date().toISOString(),
    metadata: {},
  })

  return {
    routines: {
      today: {
        name: morningRoutine.name,
        sessionId: sessionMap.get(morningRoutine.id)?.id ?? "",
        points: 35,
      },
      upcoming: {
        name: afternoonRoutine.name,
        sessionId: sessionMap.get(afternoonRoutine.id)?.id ?? "",
      },
      completed: {
        name: eveningRoutine.name,
        sessionId: sessionMap.get(eveningRoutine.id)?.id ?? "",
        pointsAwarded: sessionMap.get(eveningRoutine.id)?.points_awarded ?? 45,
      },
      totals: {
        availableToday: 1,
        totalPointsToday: 35,
        completedToday: 1,
      },
    },
    reward: {
      id: rewardsData.id,
      name: rewardsData.name,
      costPoints: rewardsData.cost_points,
    },
    walletBalance: 80,
    achievement: {
      id: achievementData.id,
      name: achievementData.name,
    },
    streakDays: 5,
  }
}

type RoutineWindowOptions = {
  familyId: string
  childProfileId: string
  routineType: "morning" | "afternoon" | "evening"
  startOffsetMinutes?: number
  durationMinutes?: number
}

function formatTimeComponent(date: Date): string {
  return date.toISOString().slice(11, 19)
}

export async function ensureRoutineSessionWindow(options: RoutineWindowOptions): Promise<string> {
  const client = createAdminClient()
  const { familyId, childProfileId, routineType } = options
  const duration = options.durationMinutes ?? 30

  const now = new Date()
  const endTime = new Date(now.getTime() + duration * 60 * 1000)
  const sessionDate = now.toISOString().slice(0, 10)

  const { data: routine, error: routineError } = await client
    .from("routines")
    .select("id")
    .eq("family_id", familyId)
    .eq("routine_type", routineType)
    .maybeSingle()

  if (routineError || !routine) {
    throw routineError ?? new Error(`Routine ${routineType} not found for family ${familyId}`)
  }

  const { data: existingSession, error: sessionError } = await client
    .from("routine_sessions")
    .select("id")
    .eq("routine_id", routine.id)
    .eq("child_profile_id", childProfileId)
    .eq("session_date", sessionDate)
    .maybeSingle()

  if (sessionError) {
    throw sessionError
  }

  let sessionId = existingSession?.id

  if (!sessionId) {
    const { data: inserted, error: insertError } = await client
      .from("routine_sessions")
      .insert({
        routine_id: routine.id,
        child_profile_id: childProfileId,
        session_date: sessionDate,
        status: "scheduled",
        planned_end_at: endTime.toISOString(),
        points_awarded: 0,
      })
      .select("id")
      .maybeSingle()

    if (insertError || !inserted) {
      throw insertError ?? new Error("Failed to create routine session")
    }

    sessionId = inserted.id
  }

  await client
    .from("routines")
    .update({
      start_time: "00:00:00",
      end_time: "23:59:00",
    })
    .eq("id", routine.id)

  await client
    .from("routine_sessions")
    .update({
      planned_end_at: endTime.toISOString(),
      status: "scheduled",
      started_at: null,
      completed_at: null,
      auto_closed_at: null,
    })
    .eq("id", sessionId)

  return sessionId
}

type RewardOptions = {
  name?: string
  description?: string
  costPoints?: number
}

export async function ensureRewardForFamily(
  familyId: string,
  options: RewardOptions = {}
): Promise<{ id: string }> {
  const client = createAdminClient()
  const { data, error } = await client
    .from("rewards")
    .select("id")
    .eq("family_id", familyId)
    .is("deleted_at", null)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)

  if (error) {
    throw error
  }

  if (data && data.length > 0) {
    return { id: data[0]!.id }
  }

  const { data: reward, error: insertError } = await client
    .from("rewards")
    .insert({
      family_id: familyId,
      name: options.name ?? "Super nagroda",
      description: options.description ?? "Nagroda testowa",
      cost_points: options.costPoints ?? 30,
      is_repeatable: true,
      is_active: true,
      settings: { source: "custom" },
    })
    .select("id")
    .maybeSingle()

  if (insertError || !reward) {
    throw insertError ?? new Error("Failed to create reward")
  }

  return { id: reward.id }
}

export async function updateRoutineWindow(
  sessionId: string,
  params: {
    startTime: string
    endTime: string
    status?: RoutineSessionStatus
  }
): Promise<void> {
  const client = createAdminClient()

  const { data: sessionRow, error: sessionError } = await client
    .from("routine_sessions")
    .select("id, routine_id, session_date")
    .eq("id", sessionId)
    .maybeSingle()

  if (sessionError) {
    throw sessionError
  }

  if (!sessionRow) {
    throw new Error(`Routine session ${sessionId} not found`)
  }

  const { error: routineUpdateError } = await client
    .from("routines")
    .update({
      start_time: params.startTime,
      end_time: params.endTime,
    })
    .eq("id", sessionRow.routine_id)

  if (routineUpdateError) {
    throw routineUpdateError
  }

  const plannedEndAt = `${sessionRow.session_date}T${params.endTime}`

  const { error: sessionUpdateError } = await client
    .from("routine_sessions")
    .update({
      planned_end_at: plannedEndAt,
      status: params.status ?? "scheduled",
      started_at: null,
      completed_at: null,
      auto_closed_at: null,
    })
    .eq("id", sessionId)

  if (sessionUpdateError) {
    throw sessionUpdateError
  }
}
