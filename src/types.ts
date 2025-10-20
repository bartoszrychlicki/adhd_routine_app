import type { Enums, Tables, TablesInsert, TablesUpdate } from "./db/database.types"

export type Uuid = string
export type IsoDateTimeString = string

export type PaginationMeta = {
  page: number
  pageSize?: number
  total?: number
}

export type PaginatedResponse<T> = {
  data: T[]
  meta: PaginationMeta
}

export type OperationMessageDto = {
  message: string
}

export type PinLockInfoDto = {
  failedAttempts: Tables<"profiles">["pin_failed_attempts"]
  lockExpiresAt: Tables<"profiles">["pin_lock_expires_at"]
}

// Family --------------------------------------------------------------------

type FamilyRow = Tables<"families">

export type FamilyDto = {
  id: FamilyRow["id"]
  familyName: FamilyRow["family_name"]
  timezone: FamilyRow["timezone"]
  settings: FamilyRow["settings"]
  createdAt: FamilyRow["created_at"]
  updatedAt: FamilyRow["updated_at"]
}

type FamilyUpdate = TablesUpdate<"families">

export type FamilyUpdateCommand = {
  familyName?: FamilyUpdate["family_name"]
  timezone?: FamilyUpdate["timezone"]
  settings?: FamilyUpdate["settings"]
}

// Profile -------------------------------------------------------------------

type ProfileRow = Tables<"profiles">
type ProfileInsert = TablesInsert<"profiles">
type ProfileUpdate = TablesUpdate<"profiles">

export type ProfileSelfDto = {
  id: ProfileRow["id"]
  familyId: ProfileRow["family_id"]
  role: ProfileRow["role"]
  displayName: ProfileRow["display_name"]
  email: ProfileRow["email"]
  avatarUrl: ProfileRow["avatar_url"]
  settings: ProfileRow["settings"]
  lastLoginAt: ProfileRow["last_login_at"]
  createdAt: ProfileRow["created_at"]
  pinLock: PinLockInfoDto
}

export type ProfileListItemDto = {
  id: ProfileRow["id"]
  role: ProfileRow["role"]
  displayName: ProfileRow["display_name"]
  email: ProfileRow["email"]
  avatarUrl: ProfileRow["avatar_url"]
  isDeleted: boolean
  lastLoginAt: ProfileRow["last_login_at"]
}

export type ProfilesListResponseDto = PaginatedResponse<ProfileListItemDto>

export type CreateChildProfileCommand = {
  displayName: ProfileInsert["display_name"]
  role: Extract<ProfileInsert["role"], "child">
  email?: ProfileInsert["email"]
  avatarUrl?: ProfileInsert["avatar_url"]
  pin?: string | null
  settings?: ProfileInsert["settings"]
}

export type ProfileCreatedDto = {
  id: ProfileRow["id"]
  familyId: ProfileRow["family_id"]
  role: ProfileRow["role"]
  displayName: ProfileRow["display_name"]
  email: ProfileRow["email"]
  avatarUrl: ProfileRow["avatar_url"]
  createdAt: ProfileRow["created_at"]
}

export type ProfileUpdateCommand = {
  displayName?: ProfileUpdate["display_name"]
  avatarUrl?: ProfileUpdate["avatar_url"]
  settings?: ProfileUpdate["settings"]
  deletedAt?: ProfileUpdate["deleted_at"]
}

export type ProfilePinUpdateCommand = {
  pin: string
  rotateTokens?: boolean
}

export type PinUpdateResultDto = {
  message: string
  pinLock: PinLockInfoDto
}

// Child Access Tokens -------------------------------------------------------

type ChildAccessTokenRow = Tables<"child_access_tokens">
type ChildAccessTokenInsert = TablesInsert<"child_access_tokens">

export type ChildAccessTokenCreateCommand = {
  metadata?: ChildAccessTokenInsert["metadata"]
}

export type ChildAccessTokenDto = {
  id: ChildAccessTokenRow["id"]
  profileId: ChildAccessTokenRow["profile_id"]
  token: ChildAccessTokenRow["token"]
  createdAt: ChildAccessTokenRow["created_at"]
  lastUsedAt: ChildAccessTokenRow["last_used_at"]
  deactivatedAt: ChildAccessTokenRow["deactivated_at"]
}

export type ChildAccessTokenListDto = {
  data: ChildAccessTokenDto[]
}

export type ChildAccessTokenDeactivateResultDto = {
  message: string
  deactivatedAt: ChildAccessTokenRow["deactivated_at"]
}

// Routines ------------------------------------------------------------------

type RoutineRow = Tables<"routines">
type RoutineInsert = TablesInsert<"routines">
type RoutineUpdate = TablesUpdate<"routines">
type RoutineType = Enums<"routine_type">

export type RoutineSummaryDto = {
  id: RoutineRow["id"]
  name: RoutineRow["name"]
  slug: RoutineRow["slug"]
  routineType: RoutineType
  startTime: RoutineRow["start_time"]
  endTime: RoutineRow["end_time"]
  autoCloseAfterMinutes: RoutineRow["auto_close_after_minutes"]
  isActive: RoutineRow["is_active"]
  settings: RoutineRow["settings"]
  createdAt: RoutineRow["created_at"]
}

export type RoutinesListResponseDto = PaginatedResponse<RoutineSummaryDto>

export type RoutineCreateCommand = {
  name: RoutineInsert["name"]
  slug: RoutineInsert["slug"]
  routineType: RoutineInsert["routine_type"]
  startTime?: RoutineInsert["start_time"]
  endTime?: RoutineInsert["end_time"]
  autoCloseAfterMinutes?: RoutineInsert["auto_close_after_minutes"]
  settings?: RoutineInsert["settings"]
}

type RoutineChildRow = Tables<"child_routines">

export type RoutineChildAssignmentDto = {
  childProfileId: RoutineChildRow["child_profile_id"]
  position: RoutineChildRow["position"]
  isEnabled: RoutineChildRow["is_enabled"]
  createdAt: RoutineChildRow["created_at"]
  updatedAt: RoutineChildRow["updated_at"]
}

export type RoutineDetailsDto = RoutineSummaryDto & {
  updatedAt: RoutineRow["updated_at"]
  deletedAt: RoutineRow["deleted_at"]
  assignedChildren?: RoutineChildAssignmentDto[]
}

export type RoutineUpdateCommand = {
  name?: RoutineUpdate["name"]
  slug?: RoutineUpdate["slug"]
  routineType?: RoutineUpdate["routine_type"]
  startTime?: RoutineUpdate["start_time"]
  endTime?: RoutineUpdate["end_time"]
  autoCloseAfterMinutes?: RoutineUpdate["auto_close_after_minutes"]
  isActive?: RoutineUpdate["is_active"]
  settings?: RoutineUpdate["settings"]
  deletedAt?: RoutineUpdate["deleted_at"]
}

export type RoutineArchiveResultDto = OperationMessageDto

// Routine Children ----------------------------------------------------------

export type RoutineChildAssignmentsResponseDto = {
  data: RoutineChildAssignmentDto[]
}

export type RoutineChildUpsertCommand = {
  position: RoutineChildRow["position"]
  isEnabled: RoutineChildRow["is_enabled"]
}

export type RoutineChildrenReorderCommand = {
  orders: Array<{
    childProfileId: RoutineChildRow["child_profile_id"]
    position: RoutineChildRow["position"]
  }>
}

export type RoutineChildrenReorderResultDto = OperationMessageDto

// Routine Tasks -------------------------------------------------------------

type RoutineTaskRow = Tables<"routine_tasks">
type RoutineTaskInsert = TablesInsert<"routine_tasks">
type RoutineTaskUpdate = TablesUpdate<"routine_tasks">

export type RoutineTaskDto = {
  id: RoutineTaskRow["id"]
  name: RoutineTaskRow["name"]
  description: RoutineTaskRow["description"]
  points: RoutineTaskRow["points"]
  position: RoutineTaskRow["position"]
  isOptional: RoutineTaskRow["is_optional"]
  isActive: RoutineTaskRow["is_active"]
  expectedDurationSeconds: RoutineTaskRow["expected_duration_seconds"]
}

export type RoutineTaskListResponseDto = {
  data: RoutineTaskDto[]
}

export type RoutineTaskCreateCommand = {
  name: RoutineTaskInsert["name"]
  description?: RoutineTaskInsert["description"]
  points?: RoutineTaskInsert["points"]
  position: RoutineTaskInsert["position"]
  isOptional?: RoutineTaskInsert["is_optional"]
  expectedDurationSeconds?: RoutineTaskInsert["expected_duration_seconds"]
}

export type RoutineTaskUpdateCommand = {
  name?: RoutineTaskUpdate["name"]
  description?: RoutineTaskUpdate["description"]
  points?: RoutineTaskUpdate["points"]
  position?: RoutineTaskUpdate["position"]
  isOptional?: RoutineTaskUpdate["is_optional"]
  isActive?: RoutineTaskUpdate["is_active"]
  expectedDurationSeconds?: RoutineTaskUpdate["expected_duration_seconds"]
  deletedAt?: RoutineTaskUpdate["deleted_at"]
}

export type RoutineTaskReorderCommand = {
  routineId: RoutineTaskRow["routine_id"]
  childProfileId: RoutineTaskRow["child_profile_id"]
  orders: Array<{
    taskId: RoutineTaskRow["id"]
    position: RoutineTaskRow["position"]
  }>
}

export type RoutineTaskReorderResultDto = OperationMessageDto

// Routine Sessions ----------------------------------------------------------

type RoutineSessionRow = Tables<"routine_sessions">
type RoutineSessionInsert = TablesInsert<"routine_sessions">
type RoutineSessionStatus = Enums<"routine_session_status">

export type RoutineSessionSummaryDto = {
  id: RoutineSessionRow["id"]
  routineId: RoutineSessionRow["routine_id"]
  sessionDate: RoutineSessionRow["session_date"]
  status: RoutineSessionStatus
  startedAt: RoutineSessionRow["started_at"]
  completedAt: RoutineSessionRow["completed_at"]
  durationSeconds: RoutineSessionRow["duration_seconds"]
  pointsAwarded: RoutineSessionRow["points_awarded"]
  bonusMultiplier: RoutineSessionRow["bonus_multiplier"]
}

export type RoutineSessionListResponseDto = PaginatedResponse<RoutineSessionSummaryDto>

export type RoutineSessionCreateCommand = {
  routineId: RoutineSessionInsert["routine_id"]
  sessionDate: RoutineSessionInsert["session_date"]
  autoStartTimer?: boolean
}

export type RoutineSessionTaskOrderEntryDto = {
  taskId: RoutineTaskRow["id"]
  position: RoutineTaskRow["position"]
}

export type RoutineSessionStartDto = {
  id: RoutineSessionRow["id"]
  status: RoutineSessionStatus
  startedAt: RoutineSessionRow["started_at"]
  plannedEndAt: RoutineSessionRow["planned_end_at"]
  taskOrder: RoutineSessionTaskOrderEntryDto[]
}

type TaskCompletionRow = Tables<"task_completions">

export type RoutineSessionTaskSummaryDto = {
  taskId: RoutineTaskRow["id"]
  name: RoutineTaskRow["name"]
  status: "completed" | "pending"
  completedAt?: TaskCompletionRow["completed_at"]
}

type RoutinePerformanceRow = Tables<"routine_performance_stats">

export type RoutinePerformanceSnapshotDto = {
  routineId: RoutinePerformanceRow["routine_id"]
  bestSessionId: RoutinePerformanceRow["best_session_id"]
  bestDurationSeconds: RoutinePerformanceRow["best_duration_seconds"]
  lastCompletedSessionId: RoutinePerformanceRow["last_completed_session_id"]
  lastCompletedAt: IsoDateTimeString | null
  streakDays: RoutinePerformanceRow["streak_days"]
}

export type RoutineSessionChildSummaryDto = {
  childProfileId: RoutineSessionRow["child_profile_id"]
  sessionId: RoutineSessionRow["id"]
  status: RoutineSessionStatus
  completedAt: RoutineSessionRow["completed_at"]
  durationSeconds: RoutineSessionRow["duration_seconds"]
  tasks?: RoutineSessionTaskSummaryDto[]
}

export type RoutineSessionDetailsDto = {
  id: RoutineSessionRow["id"]
  routineId: RoutineSessionRow["routine_id"]
  childProfileId: RoutineSessionRow["child_profile_id"]
  sessionDate: RoutineSessionRow["session_date"]
  status: RoutineSessionStatus
  startedAt: RoutineSessionRow["started_at"]
  completedAt: RoutineSessionRow["completed_at"]
  autoClosedAt: RoutineSessionRow["auto_closed_at"]
  plannedEndAt: RoutineSessionRow["planned_end_at"]
  durationSeconds: RoutineSessionRow["duration_seconds"]
  pointsAwarded: RoutineSessionRow["points_awarded"]
  bonusMultiplier: RoutineSessionRow["bonus_multiplier"]
  bestTimeBeaten: RoutineSessionRow["best_time_beaten"]
  completionReason: RoutineSessionRow["completion_reason"]
  notes: RoutineSessionRow["notes"]
  performance?: RoutinePerformanceSnapshotDto
  tasks?: RoutineSessionTaskSummaryDto[]
}

export type CompletedTaskInputDto = {
  taskId: RoutineTaskRow["id"]
  completedAt: TaskCompletionRow["completed_at"]
}

export type CompleteRoutineSessionCommand = {
  completedTasks: CompletedTaskInputDto[]
  bestTimeBeaten?: RoutineSessionRow["best_time_beaten"]
}

export type RoutineSessionCompletionDto = {
  status: RoutineSessionStatus
  completedAt: RoutineSessionRow["completed_at"]
  durationSeconds: RoutineSessionRow["duration_seconds"]
  pointsAwarded: RoutineSessionRow["points_awarded"]
  bonusMultiplier: RoutineSessionRow["bonus_multiplier"]
  pointTransactionId: Tables<"point_transactions">["id"] | null
}

export type RoutineSessionSkipCommand = {
  reason?: RoutineSessionRow["completion_reason"]
  status: Extract<RoutineSessionStatus, "skipped" | "expired">
}

export type RoutineSessionSkipResultDto = OperationMessageDto

// Task Completions ----------------------------------------------------------

type TaskCompletionInsert = TablesInsert<"task_completions">

export type TaskCompletionCommand = {
  completedAt: TaskCompletionInsert["completed_at"]
  // Request accepts free-form notes that are persisted in the JSON `metadata` column.
  notes?: TaskCompletionInsert["metadata"]
}

export type TaskCompletionResultDto = {
  taskCompletionId: TaskCompletionRow["id"]
  position: TaskCompletionRow["position"]
  status: "completed"
}

export type TaskCompletionUndoResultDto = OperationMessageDto

// Routine Performance -------------------------------------------------------

export type RoutinePerformanceStatDto = {
  routineId: RoutinePerformanceRow["routine_id"]
  childProfileId: RoutinePerformanceRow["child_profile_id"]
  bestDurationSeconds: RoutinePerformanceRow["best_duration_seconds"]
  bestSessionId: RoutinePerformanceRow["best_session_id"]
  lastCompletedSessionId: RoutinePerformanceRow["last_completed_session_id"]
  lastCompletedAt: IsoDateTimeString | null
  streakDays: RoutinePerformanceRow["streak_days"]
  updatedAt: RoutinePerformanceRow["updated_at"]
}

export type RoutinePerformanceListResponseDto = {
  data: RoutinePerformanceStatDto[]
}

// Point Transactions --------------------------------------------------------

type PointTransactionRow = Tables<"point_transactions">
type PointTransactionInsert = TablesInsert<"point_transactions">
type PointTransactionType = Enums<"point_transaction_type">

export type PointTransactionReferenceDto = {
  referenceId: PointTransactionRow["reference_id"]
  referenceTable: PointTransactionRow["reference_table"]
}

export type PointTransactionDto = {
  id: PointTransactionRow["id"]
  profileId: PointTransactionRow["profile_id"]
  transactionType: PointTransactionType
  pointsDelta: PointTransactionRow["points_delta"]
  balanceAfter: PointTransactionRow["balance_after"]
  reference: PointTransactionReferenceDto | null
  createdAt: PointTransactionRow["created_at"]
  metadata: PointTransactionRow["metadata"]
  reason: PointTransactionRow["reason"]
}

export type PointTransactionsListResponseDto = PaginatedResponse<PointTransactionDto>

export type ManualPointTransactionCommand = {
  profileId: PointTransactionInsert["profile_id"]
  pointsDelta: PointTransactionInsert["points_delta"]
  reason: PointTransactionInsert["reason"]
}

export type ManualPointTransactionResultDto = {
  id: PointTransactionRow["id"]
  balanceAfter: PointTransactionRow["balance_after"]
  createdAt: PointTransactionRow["created_at"]
}

// Family Points Snapshots ---------------------------------------------------

type FamilyPointsSnapshotRow = Tables<"family_points_snapshots">

export type FamilyPointsSnapshotDto = {
  snapshotDate: FamilyPointsSnapshotRow["snapshot_date"]
  pointsBalance: FamilyPointsSnapshotRow["points_balance"]
  earnedPoints: FamilyPointsSnapshotRow["earned_points"]
  spentPoints: FamilyPointsSnapshotRow["spent_points"]
}

export type FamilyPointsSnapshotsResponseDto = {
  data: FamilyPointsSnapshotDto[]
}

// Rewards -------------------------------------------------------------------

type RewardRow = Tables<"rewards">
type RewardInsert = TablesInsert<"rewards">
type RewardUpdate = TablesUpdate<"rewards">

export type RewardSummaryDto = {
  id: RewardRow["id"]
  name: RewardRow["name"]
  cost: RewardRow["cost_points"]
  isActive: RewardRow["is_active"]
  availableForChildIds: Uuid[]
  deletedAt: RewardRow["deleted_at"]
}

export type RewardListResponseDto = PaginatedResponse<RewardSummaryDto>

export type CreateRewardCommand = {
  name: RewardInsert["name"]
  cost: RewardInsert["cost_points"]
  description?: RewardInsert["description"]
  settings?: RewardInsert["settings"]
}

type RewardVisibilityRow = Tables<"reward_child_visibility">

export type RewardVisibilityDto = {
  childProfileId: RewardVisibilityRow["child_profile_id"]
  isVisible: RewardVisibilityRow["is_visible"]
  visibleFrom: RewardVisibilityRow["visible_from"]
  visibleUntil: RewardVisibilityRow["visible_until"]
  updatedAt: RewardVisibilityRow["updated_at"]
}

export type RewardDetailsDto = {
  id: RewardRow["id"]
  name: RewardRow["name"]
  cost: RewardRow["cost_points"]
  description: RewardRow["description"]
  isActive: RewardRow["is_active"]
  isRepeatable: RewardRow["is_repeatable"]
  settings: RewardRow["settings"]
  deletedAt: RewardRow["deleted_at"]
  childVisibility?: RewardVisibilityDto[]
}

export type UpdateRewardCommand = {
  name?: RewardUpdate["name"]
  cost?: RewardUpdate["cost_points"]
  description?: RewardUpdate["description"]
  isActive?: RewardUpdate["is_active"]
  isRepeatable?: RewardUpdate["is_repeatable"]
  settings?: RewardUpdate["settings"]
  deletedAt?: RewardUpdate["deleted_at"]
}

export type RewardVisibilityListDto = {
  data: RewardVisibilityDto[]
}

export type UpsertRewardVisibilityCommand = {
  visibleFrom?: RewardVisibilityRow["visible_from"]
  visibleUntil?: RewardVisibilityRow["visible_until"]
  // Metadata piggybacks on the reward-level JSON settings payload for per-child attributes.
  metadata?: RewardRow["settings"]
}

export type RewardVisibilityDeleteResultDto = OperationMessageDto

export type RewardArchiveResultDto = OperationMessageDto

// Reward Redemptions --------------------------------------------------------

type RewardRedemptionRow = Tables<"reward_redemptions">
type RewardRedemptionInsert = TablesInsert<"reward_redemptions">
type RewardRedemptionUpdate = TablesUpdate<"reward_redemptions">
type RewardRedemptionStatus = Enums<"reward_redemption_status">

export type RewardRedemptionDto = {
  id: RewardRedemptionRow["id"]
  rewardId: RewardRedemptionRow["reward_id"]
  childProfileId: RewardRedemptionRow["child_profile_id"]
  status: RewardRedemptionStatus
  pointsCost: RewardRedemptionRow["points_cost"]
  requestedAt: RewardRedemptionRow["requested_at"]
  confirmedAt: RewardRedemptionRow["confirmed_at"]
  confirmedByProfileId: RewardRedemptionRow["confirmed_by_profile_id"]
  cancelledAt: RewardRedemptionRow["cancelled_at"]
  cancelledByProfileId: RewardRedemptionRow["cancelled_by_profile_id"]
  pointTransactionId: RewardRedemptionRow["point_transaction_id"]
  notes: RewardRedemptionRow["notes"]
  metadata: RewardRedemptionRow["metadata"]
  updatedAt: RewardRedemptionRow["updated_at"]
}

export type RewardRedemptionListResponseDto = PaginatedResponse<RewardRedemptionDto>

export type CreateRewardRedemptionCommand = {
  childProfileId: RewardRedemptionInsert["child_profile_id"]
  notes?: RewardRedemptionInsert["notes"]
  metadata?: RewardRedemptionInsert["metadata"]
}

export type RewardRedemptionCreateResultDto = RewardRedemptionDto & {
  balanceAfter: PointTransactionRow["balance_after"]
}

export type UpdateRewardRedemptionCommand = {
  status: RewardRedemptionUpdate["status"]
  notes?: RewardRedemptionUpdate["notes"]
  confirmedByProfileId?: RewardRedemptionUpdate["confirmed_by_profile_id"]
}

// Achievements --------------------------------------------------------------

type AchievementRow = Tables<"achievements">
type AchievementInsert = TablesInsert<"achievements">
type AchievementUpdate = TablesUpdate<"achievements">

export type AchievementDto = {
  id: AchievementRow["id"]
  code: AchievementRow["code"]
  name: AchievementRow["name"]
  description: AchievementRow["description"]
  criteria: AchievementRow["criteria"]
  iconUrl: AchievementRow["icon_url"]
  isActive: AchievementRow["is_active"]
  deletedAt: AchievementRow["deleted_at"]
  createdAt: AchievementRow["created_at"]
}

export type AchievementListResponseDto = PaginatedResponse<AchievementDto>

export type CreateAchievementCommand = {
  code: AchievementInsert["code"]
  name: AchievementInsert["name"]
  description?: AchievementInsert["description"]
  criteria: AchievementInsert["criteria"]
  iconUrl?: AchievementInsert["icon_url"]
}

export type UpdateAchievementCommand = {
  name?: AchievementUpdate["name"]
  description?: AchievementUpdate["description"]
  criteria?: AchievementUpdate["criteria"]
  iconUrl?: AchievementUpdate["icon_url"]
  isActive?: AchievementUpdate["is_active"]
  deletedAt?: AchievementUpdate["deleted_at"]
}

export type UserAchievementRow = Tables<"user_achievements">
type UserAchievementInsert = TablesInsert<"user_achievements">

export type UserAchievementDto = {
  achievementId: UserAchievementRow["achievement_id"]
  code: AchievementRow["code"]
  name: AchievementRow["name"]
  description: AchievementRow["description"]
  iconUrl: AchievementRow["icon_url"]
  awardedAt: UserAchievementRow["awarded_at"]
  metadata: UserAchievementRow["metadata"]
}

export type UserAchievementListResponseDto = {
  data: UserAchievementDto[]
}

export type AwardAchievementCommand = {
  achievementId: UserAchievementInsert["achievement_id"]
  metadata?: UserAchievementInsert["metadata"]
}

// Derived Family Progress ---------------------------------------------------

export type FamilyProgressTaskSummaryDto = {
  taskId: RoutineTaskRow["id"]
  name: RoutineTaskRow["name"]
  status: "completed" | "pending" | "skipped"
}

export type FamilyProgressChildSummaryDto = {
  childProfileId: RoutineSessionRow["child_profile_id"]
  sessionId: RoutineSessionRow["id"] | null
  status: RoutineSessionStatus | "scheduled"
  completedAt: RoutineSessionRow["completed_at"]
  durationSeconds: RoutineSessionRow["duration_seconds"]
  tasks?: FamilyProgressTaskSummaryDto[]
}

export type FamilyProgressRoutineSummaryDto = {
  routineId: RoutineRow["id"]
  name: RoutineRow["name"]
  children: FamilyProgressChildSummaryDto[]
}

export type FamilyProgressSummaryDto = {
  date: RoutineSessionRow["session_date"]
  routines: FamilyProgressRoutineSummaryDto[]
}

export type FamilyProgressHistoryListDto = PaginatedResponse<FamilyProgressSummaryDto>

// Derived Wallet ------------------------------------------------------------

export type RewardPendingRedemptionDto = {
  rewardRedemptionId: RewardRedemptionRow["id"]
  pointsCost: RewardRedemptionRow["points_cost"]
  status: RewardRedemptionStatus
}

export type ChildWalletRecentTransactionDto = {
  id: PointTransactionRow["id"]
  transactionType: PointTransactionType
  pointsDelta: PointTransactionRow["points_delta"]
  createdAt: PointTransactionRow["created_at"]
}

export type ChildWalletDto = {
  balance: number
  pendingRedemptions: RewardPendingRedemptionDto[]
  recentTransactions: ChildWalletRecentTransactionDto[]
}

// Onboarding ----------------------------------------------------------------

// The onboarding settings live inside the JSON maps on families/profiles.
export type FamilyOnboardingStateDto = {
  completedSteps?: string[]
  isComplete?: boolean
}

export type ProfileOnboardingStateDto = {
  completedSteps?: string[]
  isComplete?: boolean
}

export type OnboardingStateDto = {
  profile: ProfileOnboardingStateDto
  family: FamilyOnboardingStateDto
}

export type OnboardingStateUpdateCommand = {
  profileSteps?: string[]
  familySteps?: string[]
  isComplete?: boolean
}

// Health & Support ----------------------------------------------------------

export type HealthStatusDto = {
  status: "ok"
  timestamp: IsoDateTimeString
}

export type VersionInfoDto = {
  version: string
  commit: string
  supabaseSchemaVersion: string
}
