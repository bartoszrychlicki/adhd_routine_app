# REST API Plan

## 1. Resources
- `Family` → `families` — Household container configuring timezone, settings, and soft-delete metadata.
- `Profile` → `profiles` — User identities (parent, child, admin) linked to Supabase auth or child PINs.
- `ChildAccessToken` → `child_access_tokens` — Magic-link style tokens enabling child access without password.
- `Routine` → `routines` — Configurable sequences of tasks bound to a family and routine type.
- `ChildRoutine` → `child_routines` — Per-child routine enablement and ordering records.
- `RoutineTask` → `routine_tasks` — Tasks assigned to a routine/child combination with scoring and ordering.
- `RoutineSession` → `routine_sessions` — Daily execution instances with timer, status, and scoring outcomes.
- `TaskCompletion` → `task_completions` — Fine-grained completion events per task within a session.
- `RoutinePerformanceStat` → `routine_performance_stats` — Aggregated timing benchmarks per child/routine.
- `PointTransaction` → `point_transactions` — Ledger of points earned, spent, or manually adjusted.
- `FamilyPointsSnapshot` → `family_points_snapshots` — Daily aggregated balances for reporting.
- `Reward` → `rewards` — Incentives defined by parents with cost, availability, and soft delete.
- `RewardChildVisibility` → `reward_child_visibility` — Time-boxed exposure rules per child.
- `RewardRedemption` → `reward_redemptions` — Redemption lifecycle tracking with approval and fulfillment metadata.
- `Achievement` → `achievements` — Badge catalog, optionally family-scoped, with award criteria.
- `UserAchievement` → `user_achievements` — Earned badge records per profile.
- `FamilyProgressSummary` (derived) — Aggregated view combining routines, sessions, tasks, snapshots for dashboard.
- `ChildWallet` (derived) — Aggregated balance view based on point transactions.
- `OnboardingState` (derived) — Progress flags stored in `families.settings` and `profiles.settings`.

## 2. Endpoints

### 2.1 Family

- **GET `/families/current`**
  - Description: Retrieve the authenticated parent/admin family record; uses Supabase JWT to resolve `family_id`.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Query Parameters: None
  - Request JSON: —
  - Response JSON:
    ```json
    {
      "id": "uuid",
      "familyName": "string",
      "timezone": "Europe/Warsaw",
      "settings": {
        "onboarding": {
          "completedSteps": ["string"],
          "isComplete": false
        }
      },
      "createdAt": "ISO-8601",
      "updatedAt": "ISO-8601"
    }
    ```
  - Success: `200 OK` – Family profile retrieved.
  - Errors:
    - `401 Unauthorized` – Missing or invalid Supabase session.
    - `404 Not Found` – Authenticated user has no associated family.

- **PATCH `/families/{familyId}`**
  - Description: Update family metadata (name, timezone, onboarding settings); RLS restricts to parent/admin owning the family.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Query Parameters: None
  - Request JSON:
    ```json
    {
      "familyName": "string",
      "timezone": "string",
      "settings": {
        "onboarding": {
          "completedSteps": ["string"],
          "isComplete": false
        },
        "notificationPreferences": {}
      }
    }
    ```
  - Response JSON: Same shape as `GET /families/current`.
  - Success: `200 OK` – Family updated.
  - Errors:
    - `400 Bad Request` – Invalid timezone or payload schema.
    - `403 Forbidden` – Attempt to update another family.
    - `409 Conflict` – Concurrent update detected via `updated_at` guard.

### 2.2 Profile

- **GET `/profiles/me`**
  - Description: Return the caller’s profile (parent or child) including role, family linkage, and onboarding flags.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Query Parameters: None
  - Request JSON: —
  - Response JSON:
    ```json
    {
      "id": "uuid",
      "familyId": "uuid",
      "role": "parent",
      "displayName": "string",
      "email": "string",
      "avatarUrl": "string",
      "settings": {
        "onboarding": {
          "needsInitialSetup": true
        }
      },
      "lastLoginAt": "ISO-8601",
      "createdAt": "ISO-8601",
      "pinLock": {
        "failedAttempts": 0,
        "lockExpiresAt": "ISO-8601"
      }
    }
    ```
  - Success: `200 OK` – Profile returned.
  - Errors:
    - `401 Unauthorized` – No active Supabase session or child token.

- **GET `/families/{familyId}/profiles`**
  - Description: List profiles within a family with role-based filtering; leveraged by parent dashboards.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Query Parameters:
    - `role` (`parent|child|admin`, optional)
    - `includeDeleted` (`boolean`, default `false`)
    - `page` (number ≥1, default 1)
    - `pageSize` (number 1–100, default 25)
    - `sort` (`createdAt|displayName`, default `createdAt`)
    - `order` (`asc|desc`, default `desc`)
  - Request JSON: —
  - Response JSON:
    ```json
    {
      "data": [
        {
          "id": "uuid",
          "role": "child",
          "displayName": "string",
          "email": "string",
          "avatarUrl": "string",
          "isDeleted": false,
          "lastLoginAt": "ISO-8601"
        }
      ],
      "meta": {
        "page": 1,
        "pageSize": 25,
        "total": 42
      }
    }
    ```
  - Success: `200 OK` – Profiles listed.
  - Errors:
    - `400 Bad Request` – Invalid pagination options.
    - `403 Forbidden` – Caller not a parent/admin of family.

- **POST `/families/{familyId}/profiles`**
  - Description: Create a child profile with optional PIN; parents/admins only.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Query Parameters: None
  - Request JSON:
    ```json
    {
      "displayName": "string",
      "role": "child",
      "email": "string|null",
      "avatarUrl": "string|null",
      "pin": "string|null",
      "settings": {}
    }
    ```
  - Response JSON:
    ```json
    {
      "id": "uuid",
      "familyId": "uuid",
      "role": "child",
      "displayName": "string",
      "email": "string",
      "avatarUrl": "string",
      "createdAt": "ISO-8601"
    }
    ```
  - Success: `201 Created` – Child profile created.
  - Errors:
    - `400 Bad Request` – Role not allowed or pin invalid (must hash).
    - `409 Conflict` – Email already linked to another profile.

- **PATCH `/profiles/{profileId}`**
  - Description: Update display name, avatar, settings, or soft-delete flag; parent can manage children, child can update self (limited fields).
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Query Parameters: None
  - Request JSON:
    ```json
    {
      "displayName": "string",
      "avatarUrl": "string",
      "settings": {},
      "deletedAt": "ISO-8601|null"
    }
    ```
  - Response JSON: Updated profile object.
  - Success: `200 OK` – Profile updated.
  - Errors:
    - `403 Forbidden` – Caller lacks permission or attempts to delete parent profile.
    - `409 Conflict` – Soft delete conflicts with active child access token.

- **POST `/profiles/{profileId}/pin`**
  - Description: Parent resets or child sets PIN; hashed server-side using Argon2.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Query Parameters: None
  - Request JSON:
    ```json
    {
      "pin": "string",
      "rotateTokens": true
    }
    ```
  - Response JSON:
    ```json
    {
      "message": "PIN updated",
      "pinLock": {
        "failedAttempts": 0,
        "lockExpiresAt": null
      }
    }
    ```
  - Success: `200 OK` – PIN updated.
  - Errors:
    - `400 Bad Request` – PIN format invalid (4 digits requirement).
    - `423 Locked` – PIN temporarily locked due to repeated failures.

### 2.3 Child Access Token

- **POST `/profiles/{childId}/access-tokens`**
  - Description: Issue a new child access token; revokes previous active token due to partial unique index.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Query Parameters: None
  - Request JSON:
    ```json
    {
      "metadata": {
        "label": "string"
      }
    }
    ```
  - Response JSON:
    ```json
    {
      "id": "uuid",
      "profileId": "uuid",
      "token": "string",
      "createdAt": "ISO-8601",
      "lastUsedAt": null
    }
    ```
  - Success: `201 Created` – Token issued.
  - Errors:
    - `403 Forbidden` – Caller not parent/admin of child.

- **GET `/profiles/{childId}/access-tokens`**
  - Description: List active and historical child access tokens for auditing.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Query Parameters:
    - `includeInactive` (`boolean`, default `false`)
  - Request JSON: —
  - Response JSON:
    ```json
    {
      "data": [
        {
          "id": "uuid",
          "token": "string",
          "createdAt": "ISO-8601",
          "lastUsedAt": "ISO-8601",
          "deactivatedAt": null
        }
      ]
    }
    ```
  - Success: `200 OK` – Tokens returned.
  - Errors:
    - `403 Forbidden` – Caller not permitted to view child tokens.

- **POST `/child-access-tokens/{tokenId}/deactivate`**
  - Description: Soft-deactivate a token (sets `deactivated_at`, `deactivated_by_profile_id`).
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Query Parameters: None
  - Request JSON: —
  - Response JSON:
    ```json
    {
      "message": "Token deactivated",
      "deactivatedAt": "ISO-8601"
    }
    ```
  - Success: `200 OK` – Token deactivated.
  - Errors:
    - `404 Not Found` – Token not found or already deactivated.

### 2.4 Routine

- **GET `/families/{familyId}/routines`**
  - Description: List routines with filtering by type and active flag; leverages `routines_family_active_idx`.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Query Parameters:
    - `routineType` (`morning|afternoon|evening|custom`, optional)
    - `isActive` (`boolean`, default `true`)
    - `includeDeleted` (`boolean`, default `false`)
    - `page`, `pageSize`, `sort` (`name|createdAt`), `order` (`asc|desc`)
  - Request JSON: —
  - Response JSON:
    ```json
    {
      "data": [
        {
          "id": "uuid",
          "name": "Morning Routine",
          "slug": "morning",
          "routineType": "morning",
          "startTime": "07:00:00",
          "endTime": "08:00:00",
          "autoCloseAfterMinutes": 30,
          "isActive": true,
          "settings": {},
          "createdAt": "ISO-8601"
        }
      ],
      "meta": {
        "page": 1,
        "pageSize": 25,
        "total": 3
      }
    }
    ```
  - Success: `200 OK` – Routines listed.
  - Errors:
    - `403 Forbidden` – Caller not authorized for family.

- **POST `/families/{familyId}/routines`**
  - Description: Create a routine (parents/admin only); slug uniqueness enforced per family.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Query Parameters: None
  - Request JSON:
    ```json
    {
      "name": "string",
      "slug": "string",
      "routineType": "morning",
      "startTime": "HH:MM:SS|null",
      "endTime": "HH:MM:SS|null",
      "autoCloseAfterMinutes": 30,
      "settings": {}
    }
    ```
  - Response JSON: Newly created routine.
  - Success: `201 Created` – Routine created.
  - Errors:
    - `400 Bad Request` – Invalid time window or auto-close ≤0.
    - `409 Conflict` – Slug already exists.

- **GET `/routines/{routineId}`**
  - Description: Fetch routine details with optional child assignments.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Query Parameters:
    - `includeChildren` (`boolean`, default `false`)
  - Request JSON: —
  - Response JSON: Routine object with optional `assignedChildren`.
  - Success: `200 OK`.
  - Errors:
    - `404 Not Found` – Routine missing or soft-deleted.

- **PATCH `/routines/{routineId}`**
  - Description: Update routine metadata and activation status.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Query Parameters: None
  - Request JSON: Partial routine fields.
  - Response JSON: Updated routine.
  - Success: `200 OK`.
  - Errors:
    - `400 Bad Request` – Validation failure (e.g., end before start).
    - `409 Conflict` – Attempt to reactivate while child assignments disabled.

- **DELETE `/routines/{routineId}`**
  - Description: Soft delete routine (`deleted_at=now()`).
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Query Parameters: None
  - Request JSON: —
  - Response JSON:
    ```json
    {
      "message": "Routine archived"
    }
    ```
  - Success: `200 OK` – Routine archived.
  - Errors:
    - `409 Conflict` – Routine has pending sessions; must deactivate first.

### 2.5 Child Routine

- **GET `/routines/{routineId}/children`**
  - Description: Retrieve children assigned to a routine in display order; supports toggling visibility.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Query Parameters:
    - `includeDisabled` (`boolean`, default `false`)
  - Request JSON: —
  - Response JSON:
    ```json
    {
      "data": [
        {
          "childProfileId": "uuid",
          "position": 1,
          "isEnabled": true,
          "createdAt": "ISO-8601"
        }
      ]
    }
    ```
  - Success: `200 OK`.
  - Errors:
    - `403 Forbidden` – Caller lacks access.

- **PUT `/routines/{routineId}/children/{childId}`**
  - Description: Assign or update routine visibility for a child; upserts `child_routines`.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Query Parameters: None
  - Request JSON:
    ```json
    {
      "position": 1,
      "isEnabled": true
    }
    ```
  - Response JSON: Assignment record.
  - Success: `200 OK` – Assignment saved.
  - Errors:
    - `400 Bad Request` – Position ≤0.

- **PATCH `/routines/{routineId}/children/reorder`**
  - Description: Bulk reorder child positions to maintain contiguous ordering.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Query Parameters: None
  - Request JSON:
    ```json
    {
      "orders": [
        {
          "childProfileId": "uuid",
          "position": 1
        }
      ]
    }
    ```
  - Response JSON:
    ```json
    {
      "message": "Positions updated"
    }
    ```
  - Success: `200 OK`.
  - Errors:
    - `422 Unprocessable Entity` – Duplicate positions provided.

### 2.6 Routine Task

- **GET `/routines/{routineId}/children/{childId}/tasks`**
  - Description: List tasks for a child within a routine ordered by `position`; uses `routine_tasks_child_order_idx`.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Query Parameters:
    - `includeInactive` (`boolean`, default `false`)
  - Request JSON: —
  - Response JSON:
    ```json
    {
      "data": [
        {
          "id": "uuid",
          "name": "string",
          "description": "string",
          "points": 10,
          "position": 1,
          "isOptional": false,
          "isActive": true,
          "expectedDurationSeconds": 120
        }
      ]
    }
    ```
  - Success: `200 OK`.
  - Errors:
    - `404 Not Found` – Child not assigned to routine.

- **POST `/routines/{routineId}/children/{childId}/tasks`**
  - Description: Create a task within the routine/child scope.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Query Parameters: None
  - Request JSON:
    ```json
    {
      "name": "string",
      "description": "string|null",
      "points": 10,
      "position": 1,
      "isOptional": false,
      "expectedDurationSeconds": 120
    }
    ```
  - Response JSON: Created task record.
  - Success: `201 Created`.
  - Errors:
    - `400 Bad Request` – Points <0 or position <1.
    - `409 Conflict` – Position already used.

- **PATCH `/routine-tasks/{taskId}`**
  - Description: Update task metadata, optionally soft delete (`deletedAt`).
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Query Parameters: None
  - Request JSON: Partial fields such as `name`, `points`, `isActive`, `deletedAt`.
  - Response JSON: Updated task.
  - Success: `200 OK`.
  - Errors:
    - `409 Conflict` – Attempt to deactivate mandatory tasks while session active.

- **PATCH `/routine-tasks/reorder`**
  - Description: Bulk reorder tasks within a routine/child scope.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Query Parameters: None
  - Request JSON:
    ```json
    {
      "routineId": "uuid",
      "childProfileId": "uuid",
      "orders": [
        {
          "taskId": "uuid",
          "position": 1
        }
      ]
    }
    ```
  - Response JSON: Confirmation message.
  - Success: `200 OK`.
  - Errors:
    - `422 Unprocessable Entity` – Non-contiguous ordering.

### 2.7 Routine Session

- **GET `/children/{childId}/sessions`**
  - Description: List sessions for a child with optional filters; uses `routine_sessions_child_date_idx`.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Query Parameters:
    - `status` (`scheduled|in_progress|completed|auto_closed|skipped|expired`, optional)
    - `fromDate`, `toDate` (`YYYY-MM-DD`, optional)
    - `routineId` (`uuid`, optional)
    - `page`, `pageSize`, `sort` (`sessionDate|startedAt|completedAt`), `order`
  - Request JSON: —
  - Response JSON:
    ```json
    {
      "data": [
        {
          "id": "uuid",
          "routineId": "uuid",
          "sessionDate": "2024-04-01",
          "status": "completed",
          "startedAt": "ISO-8601",
          "completedAt": "ISO-8601",
          "durationSeconds": 900,
          "pointsAwarded": 120,
          "bonusMultiplier": 2.0
        }
      ],
      "meta": {
        "page": 1,
        "total": 12
      }
    }
    ```
  - Success: `200 OK`.
  - Errors:
    - `403 Forbidden` – Child trying to view another child’s sessions.

- **POST `/children/{childId}/sessions`**
  - Description: Create or start a session; transitions status to `in_progress`, sets `started_at`, `planned_end_at`.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Query Parameters: None
  - Request JSON:
    ```json
    {
      "routineId": "uuid",
      "sessionDate": "YYYY-MM-DD",
      "autoStartTimer": true
    }
    ```
  - Response JSON:
    ```json
    {
      "id": "uuid",
      "status": "in_progress",
      "startedAt": "ISO-8601",
      "plannedEndAt": "ISO-8601",
      "taskOrder": [
        {
          "taskId": "uuid",
          "position": 1
        }
      ]
    }
    ```
  - Success: `201 Created` – Session started.
  - Errors:
    - `409 Conflict` – Existing in-progress session for same routine/date.

- **GET `/sessions/{sessionId}`**
  - Description: Retrieve full session details including task statuses and performance stats snapshot.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Query Parameters:
    - `includeTasks` (`boolean`, default `true`)
    - `includePerformance` (`boolean`, default `true`)
  - Request JSON: —
  - Response JSON: Session object with nested completions.
  - Success: `200 OK`.
  - Errors:
    - `404 Not Found`.

- **POST `/sessions/{sessionId}/complete`**
  - Description: Finalize a session; calculates duration, applies bonus by comparing with `routine_performance_stats`, writes `point_transactions`.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Query Parameters: None
  - Request JSON:
    ```json
    {
      "completedTasks": [
        {
          "taskId": "uuid",
          "completedAt": "ISO-8601"
        }
      ],
      "bestTimeBeaten": true
    }
    ```
  - Response JSON:
    ```json
    {
      "status": "completed",
      "completedAt": "ISO-8601",
      "durationSeconds": 900,
      "pointsAwarded": 120,
      "bonusMultiplier": 2.0,
      "pointTransactionId": "uuid"
    }
    ```
  - Success: `200 OK` – Session completed.
  - Errors:
    - `409 Conflict` – Tasks incomplete or already completed session.

- **POST `/sessions/{sessionId}/skip`**
  - Description: Mark session as skipped or expired (parent action).
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Query Parameters: None
  - Request JSON:
    ```json
    {
      "reason": "string",
      "status": "skipped"
    }
    ```
  - Response JSON:
    ```json
    {
      "status": "skipped",
      "message": "Session skipped"
    }
    ```
  - Success: `200 OK`.
  - Errors:
    - `403 Forbidden` – Child attempt to skip without parent approval.

### 2.8 Task Completion

- **POST `/sessions/{sessionId}/tasks/{taskId}/complete`**
  - Description: Mark a task as completed in order sequence; updates `position` status and awards task points.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Query Parameters: None
  - Request JSON:
    ```json
    {
      "completedAt": "ISO-8601",
      "notes": "string|null"
    }
    ```
  - Response JSON:
    ```json
    {
      "taskCompletionId": "uuid",
      "position": 1,
      "status": "completed"
    }
    ```
  - Success: `200 OK`.
  - Errors:
    - `409 Conflict` – Task already completed or out of order.

- **POST `/sessions/{sessionId}/tasks/{taskCompletionId}/undo`**
  - Description: Allow parent/admin to undo completion (sets `deleted_at` on completion and adjusts score).
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Query Parameters: None
  - Request JSON: —
  - Response JSON:
    ```json
    {
      "message": "Task completion reverted"
    }
    ```
  - Success: `200 OK`.
  - Errors:
    - `403 Forbidden` – Child cannot undo.

### 2.9 Routine Performance Stat

- **GET `/children/{childId}/performance/routines`**
  - Description: Fetch per-routine stats including best duration and last completion; used for timer comparisons.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Query Parameters:
    - `routineId` (`uuid`, optional)
  - Request JSON: —
  - Response JSON:
    ```json
    {
      "data": [
        {
          "routineId": "uuid",
          "bestDurationSeconds": 850,
          "bestSessionId": "uuid",
          "lastCompletedSessionId": "uuid",
          "lastCompletedAt": "ISO-8601"
        }
      ]
    }
    ```
  - Success: `200 OK`.
  - Errors:
    - `404 Not Found` – Routine stat missing (return empty data preferred).

### 2.10 Point Transaction

- **GET `/families/{familyId}/points/transactions`**
  - Description: Paginated ledger with filters; uses `point_transactions_family_type_idx`.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Query Parameters:
    - `childProfileId` (`uuid`, optional)
    - `transactionType` (`task_completion|routine_bonus|manual_adjustment|reward_redeem`, optional)
    - `from` / `to` (`ISO-8601`, optional)
    - `page`, `pageSize`, `sort` (`createdAt|pointsDelta`), `order`
  - Request JSON: —
  - Response JSON:
    ```json
    {
      "data": [
        {
          "id": "uuid",
          "profileId": "uuid",
          "transactionType": "task_completion",
          "pointsDelta": 10,
          "balanceAfter": 120,
          "reference": {
            "sessionId": "uuid",
            "taskCompletionId": "uuid"
          },
          "createdAt": "ISO-8601",
          "metadata": {}
        }
      ],
      "meta": {
        "page": 1,
        "pageSize": 25,
        "total": 100
      }
    }
    ```
  - Success: `200 OK`.
  - Errors:
    - `403 Forbidden` – Child attempting to view entire family ledger.

- **POST `/families/{familyId}/points/transactions`**
  - Description: Manual point adjustment by parent/admin; writes `manual_adjustment` entries.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Query Parameters: None
  - Request JSON:
    ```json
    {
      "profileId": "uuid",
      "pointsDelta": 20,
      "reason": "string"
    }
    ```
  - Response JSON:
    ```json
    {
      "id": "uuid",
      "balanceAfter": 140,
      "createdAt": "ISO-8601"
    }
    ```
  - Success: `201 Created`.
  - Errors:
    - `400 Bad Request` – Zero delta or missing reason.

### 2.11 Family Points Snapshot

- **GET `/families/{familyId}/points/snapshots`**
  - Description: Return historical balances for trend charts; leverages `family_points_snapshots_profile_date_idx`.
  - Query Parameters:
    - `profileId` (`uuid`, optional)
    - `fromDate`, `toDate` (`YYYY-MM-DD`, optional, default last 30 days)
  - Request JSON: —
  - Response JSON:
    ```json
    {
      "data": [
        {
          "snapshotDate": "2024-04-01",
          "pointsBalance": 120,
          "earnedPoints": 30,
          "spentPoints": 10
        }
      ]
    }
    ```
  - Success: `200 OK`.
  - Errors:
    - `400 Bad Request` – Date window > 1 year.

### 2.12 Reward

- **GET `/families/{familyId}/rewards`**
  - Description: List rewards with optional filters; uses `rewards_family_active_idx`.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Query Parameters:
    - `includeDeleted` (`boolean`, default `false`)
    - `childProfileId` (`uuid`, optional) — includes visibility info.
    - `page`, `pageSize`, `sort` (`cost|name|createdAt`), `order`
  - Request JSON: —
  - Response JSON:
    ```json
    {
      "data": [
        {
          "id": "uuid",
          "name": "Movie Night",
          "cost": 150,
          "isActive": true,
          "availableForChildIds": ["uuid"],
          "deletedAt": null
        }
      ],
      "meta": {
        "page": 1,
        "total": 8
      }
    }
    ```
  - Success: `200 OK`.
  - Errors:
    - `403 Forbidden`.

- **POST `/families/{familyId}/rewards`**
  - Description: Create reward.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Query Parameters: None
  - Request JSON:
    ```json
    {
      "name": "string",
      "cost": 100,
      "description": "string|null",
      "settings": {}
    }
    ```
  - Response JSON: Created reward.
  - Success: `201 Created`.
  - Errors:
    - `400 Bad Request` – Cost ≤0.

- **GET `/rewards/{rewardId}`**
  - Description: Fetch reward with visibility schedule.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Query Parameters: None
  - Request JSON: —
  - Response JSON: Reward object with `childVisibility`.
  - Success: `200 OK`.
  - Errors:
    - `404 Not Found`.

- **PATCH `/rewards/{rewardId}`**
  - Description: Update reward metadata, activate/deactivate, or soft delete.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Query Parameters: None
  - Request JSON: Partial reward fields.
  - Response JSON: Updated reward.
  - Success: `200 OK`.
  - Errors:
    - `409 Conflict` – Attempt to deactivate while pending redemption.

- **DELETE `/rewards/{rewardId}`**
  - Description: Soft delete reward.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Request JSON: —
  - Response JSON: `{ "message": "Reward archived" }`
  - Success: `200 OK`.
  - Errors:
    - `409 Conflict` – Fulfillment in progress.

### 2.13 Reward Child Visibility

- **GET `/rewards/{rewardId}/visibility`**
  - Description: List visibility windows for children.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Query Parameters: None
  - Request JSON: —
  - Response JSON:
    ```json
    {
      "data": [
        {
          "childProfileId": "uuid",
          "visibleFrom": "ISO-8601",
          "visibleUntil": "ISO-8601"
        }
      ]
    }
    ```
  - Success: `200 OK`.

- **PUT `/rewards/{rewardId}/visibility/{childId}`**
  - Description: Upsert visibility window.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Request JSON:
    ```json
    {
      "visibleFrom": "ISO-8601|null",
      "visibleUntil": "ISO-8601|null",
      "metadata": {}
    }
    ```
  - Response JSON: Visibility record.
  - Success: `200 OK`.
  - Errors:
    - `422 Unprocessable Entity` – `visibleUntil` before `visibleFrom`.

- **DELETE `/rewards/{rewardId}/visibility/{childId}`**
  - Description: Remove visibility window (soft delete by setting `deletedAt`).
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Request JSON: —
  - Response JSON: `{ "message": "Visibility removed" }`
  - Success: `200 OK`.

### 2.14 Reward Redemption

- **POST `/rewards/{rewardId}/redeem`**
  - Description: Child initiates redemption; creates pending `reward_redemptions` and corresponding negative `point_transaction`.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Query Parameters: None
  - Request JSON:
    ```json
    {
      "childProfileId": "uuid",
      "notes": "string|null"
    }
    ```
  - Response JSON:
    ```json
    {
      "id": "uuid",
      "status": "pending",
      "pointsCost": 150,
      "requestedAt": "ISO-8601",
      "pointTransactionId": "uuid",
      "balanceAfter": 50
    }
    ```
  - Success: `201 Created`.
  - Errors:
    - `402 Payment Required` – Insufficient points.
    - `409 Conflict` – Reward inactive or child visibility expired.

- **GET `/children/{childId}/reward-redemptions`**
  - Description: List redemptions for child (child or parent).
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Query Parameters:
    - `status` (`pending|approved|fulfilled|rejected|cancelled`, optional)
    - `page`, `pageSize`, `sort` (`requestedAt|status`), `order`
  - Request JSON: —
  - Response JSON: Paginated redemption list.
  - Success: `200 OK`.

- **PATCH `/reward-redemptions/{redemptionId}`**
  - Description: Parent/admin updates status (`approved`, `fulfilled`, `rejected`, `cancelled`) and attaches confirmation metadata.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Request JSON:
    ```json
    {
      "status": "approved",
      "notes": "string",
      "confirmedByProfileId": "uuid|null"
    }
    ```
  - Response JSON: Updated redemption record.
  - Success: `200 OK`.
  - Errors:
    - `409 Conflict` – Invalid status transition.

### 2.15 Achievement

- **GET `/families/{familyId}/achievements`**
  - Description: List achievement catalog (global and family-specific).
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Query Parameters:
    - `isActive` (`boolean`, default `true`)
    - `page`, `pageSize`, `sort` (`name|createdAt`)
  - Request JSON: —
  - Response JSON: Paginated achievements.
  - Success: `200 OK`.

- **POST `/families/{familyId}/achievements`**
  - Description: Create achievement definition.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Request JSON:
    ```json
    {
      "code": "string",
      "name": "string",
      "description": "string",
      "criteria": {},
      "iconUrl": "string|null"
    }
    ```
  - Response JSON: Created achievement.
  - Success: `201 Created`.
  - Errors:
    - `409 Conflict` – Duplicate code.

- **PATCH `/achievements/{achievementId}`**
  - Description: Update metadata or soft delete.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Request JSON: Partial fields inc. `isActive`, `deletedAt`.
  - Response JSON: Updated achievement.
  - Success: `200 OK`.

- **DELETE `/achievements/{achievementId}`**
  - Description: Soft delete by setting `deletedAt`.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Response JSON: `{ "message": "Achievement archived" }`
  - Success: `200 OK`.

### 2.16 User Achievement

- **GET `/children/{childId}/achievements`**
  - Description: List earned achievements with metadata for gallery view.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Query Parameters:
    - `includeCriteria` (`boolean`, default `false`)
  - Request JSON: —
  - Response JSON:
    ```json
    {
      "data": [
        {
          "achievementId": "uuid",
          "code": "string",
          "name": "string",
          "description": "string",
          "iconUrl": "string",
          "awardedAt": "ISO-8601"
        }
      ]
    }
    ```
  - Success: `200 OK`.

- **POST `/children/{childId}/achievements`**
  - Description: Parent/admin manually awards an achievement; ensures uniqueness per child.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Request JSON:
    ```json
    {
      "achievementId": "uuid",
      "metadata": {}
    }
    ```
  - Response JSON: Created user achievement.
  - Success: `201 Created`.
  - Errors:
    - `409 Conflict` – Achievement already awarded.

### 2.17 Family Progress Summary (Derived)

- **GET `/families/{familyId}/progress`**
  - Description: Dashboard endpoint combining routines, sessions, and task statuses for a day.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Query Parameters:
    - `date` (`YYYY-MM-DD`, default today)
    - `includeHistory` (`boolean`, default `false`) — returns previous day summary when true.
  - Request JSON: —
  - Response JSON:
    ```json
    {
      "date": "2024-04-01",
      "routines": [
        {
          "routineId": "uuid",
          "name": "Morning",
          "children": [
            {
              "childProfileId": "uuid",
              "sessionId": "uuid",
              "status": "completed",
              "completedAt": "ISO-8601",
              "durationSeconds": 900,
              "tasks": [
                {
                  "taskId": "uuid",
                  "name": "Brush teeth",
                  "status": "completed"
                }
              ]
            }
          ]
        }
      ]
    }
    ```
  - Success: `200 OK`.
  - Errors:
    - `400 Bad Request` – Date outside allowed range.

- **GET `/families/{familyId}/progress/history`**
  - Description: Paginated historical summaries leveraging `family_points_snapshots` + sessions.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Query Parameters:
    - `page`, `pageSize`, `fromDate`, `toDate`
  - Response JSON: Paginated list of daily summaries.
  - Success: `200 OK`.

### 2.18 Child Wallet (Derived)

- **GET `/children/{childId}/wallet`**
  - Description: Returns current balance, pending deductions, and recent transactions; uses `point_transactions_profile_created_idx`.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Query Parameters:
    - `includeTransactions` (`boolean`, default `true`)
    - `transactionsLimit` (number, default 5)
  - Request JSON: —
  - Response JSON:
    ```json
    {
      "balance": 270,
      "pendingRedemptions": [
        {
          "rewardRedemptionId": "uuid",
          "pointsCost": 150,
          "status": "pending"
        }
      ],
      "recentTransactions": [
        {
          "id": "uuid",
          "transactionType": "task_completion",
          "pointsDelta": 10,
          "createdAt": "ISO-8601"
        }
      ]
    }
    ```
  - Success: `200 OK`.
  - Errors:
    - `403 Forbidden` – Parent-only parameter misuse flagged.

### 2.19 Onboarding State (Derived)

- **GET `/onboarding/state`**
  - Description: Return combined onboarding status for current profile and family.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Query Parameters: None
  - Request JSON: —
  - Response JSON:
    ```json
    {
      "profile": {
        "completedSteps": ["welcome"],
        "isComplete": false
      },
      "family": {
        "completedSteps": ["add-first-task", "create-first-reward"],
        "isComplete": false
      }
    }
    ```
  - Success: `200 OK`.

- **POST `/onboarding/state`**
  - Description: Mark onboarding steps complete; writes to `profiles.settings` and `families.settings`.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Request JSON:
    ```json
    {
      "profileSteps": ["welcome", "tour"],
      "familySteps": ["add-first-task"],
      "isComplete": true
    }
    ```
  - Response JSON: Updated state.
  - Success: `200 OK`.

### 2.20 Health & Support

- **GET `/health`**
  - Description: Lightweight status for uptime monitoring.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Response JSON: `{ "status": "ok", "timestamp": "ISO-8601" }`
  - Success: `200 OK`.

- **GET `/version`**
  - Description: Returns API version metadata for clients.
  - Implementation Status: ✅ Implemented in Next.js route handler.
  - Response JSON:
    ```json
    {
      "version": "v1",
      "commit": "string",
      "supabaseSchemaVersion": "string"
    }
    ```
  - Success: `200 OK`.

## 3. Authentication and Authorization
- Leverage Supabase Auth with JWT; client obtains session via Supabase SDK, passes `Authorization: Bearer <JWT>` to REST endpoints.
- Enforce role claims (`role=parent|child|admin`) and `profile_id` claims for children to align with RLS policies defined in the database.
- Parent/admin endpoints require `role` claim in (`parent`,`admin`); child endpoints validate `profile_id` matches path parameters.
- Utilize Supabase Row Level Security to further constrain direct database access; API layer should mirror these constraints and never bypass RLS except via service role for scheduled jobs.
- Child access tokens translate into session JWTs via Edge Function sign-in; API validates token status (not deactivated).
- Support optional API key (service role) for internal cron/Edge Functions with enhanced privileges; restrict to endpoints needing cross-family access (e.g., nightly snapshots).
- Apply rate limiting (e.g., 60 requests/minute per IP) using middleware; return `429 Too Many Requests` with retry-after header.

## 4. Validation and Business Logic
- **Family**
  - Validate `timezone` against IANA list; prevent changes if active sessions are scheduled outside new window without recalculation.
  - Enforce soft delete semantics by rejecting direct deletion requests (use `deletedAt` fields).
- **Profile**
  - Permit `role` change only for admin operations; ensure parent profiles always maintain `auth_user_id`.
  - Hash PIN using Argon2; enforce 4–6 digit numeric input; reset `pin_failed_attempts` on success.
  - Auto-lock child login when `pin_failed_attempts >= 5`, populating `pin_lock_expires_at`.
- **Child Access Token**
  - Ensure only one active token per child via transaction that deactivates previous active token.
  - Log `created_by_profile_id` and `deactivated_by_profile_id` for auditing.
- **Routine**
  - Validate `startTime < endTime`; ensure `autoCloseAfterMinutes` >0 when provided.
  - Prevent slug changes when linked to recurring automations unless revalidation occurs.
- **Child Routine**
  - Maintain contiguous `position` values starting at 1; enforce via reorder endpoint.
  - Disallow disabling if child has an `in_progress` session for routine unless admin override.
- **Routine Task**
  - Enforce non-negative `points`, `expectedDurationSeconds` >0 if provided.
  - Keep `position` unique per (`child_profile_id`,`routine_id`); reject updates violating constraint.
  - When task deactivated, automatically close open `task_completions` references.
- **Routine Session**
  - Status transitions allowed: `scheduled → in_progress → completed|skipped|expired`, `in_progress → auto_closed` (timeout).
  - Autoclose logic triggered by Edge Function when `planned_end_at` elapses without completion; sets `status=auto_closed`.
  - Completion endpoint recalculates `duration_seconds`, sets `best_time_beaten` and updates `routine_performance_stats`.
- **Task Completion**
  - Enforce sequential task completion; next task becomes available only after previous completion.
  - Prevent child from completing optional task before mandatory ones if gating rules configured in `settings`.
- **Point Transaction**
  - Validate resulting `balance_after >= 0`; reject redemptions causing negative balances.
  - Attach `reference_id` and `reference_type` to correlate with sessions, redemptions.
- **Family Points Snapshot**
  - Generated nightly via service role; API only reads to avoid tampering.
- **Reward**
  - Enforce cost >0 and integer; deactivating a reward auto-cancels pending redemptions with parent notification.
  - Ensure reward is visible to child before allowing redemption.
- **Reward Child Visibility**
  - Validate time windows; treat nulls as always visible; avoid overlapping windows by merging.
- **Reward Redemption**
  - Status transitions: `pending → approved|rejected|cancelled`; `approved → fulfilled`; `pending|approved → cancelled` (child can cancel pending only).
  - When `approved`, optionally reserve inventory; `fulfilled` triggers confirmation timestamp.
- **Achievement**
  - Enforce unique `code`; store automation criteria for future auto-award logic.
  - Allow toggling `is_active`; when disabling, keep existing `user_achievements`.
- **User Achievement**
  - Prevent duplicate awards; optionally attach awarding profile for audit.
- **Family Progress Summary**
  - Combine data via SQL view or Edge Function to minimize per-request joins; cache per day.
  - Include computed KPIs (completion rate, total points).
- **Child Wallet**
  - Compute balance using latest `point_transactions` rather than snapshots to remain real time.
- **Onboarding State**
  - Write operations merge steps atomically to prevent race conditions between multi-tab sessions.
- **Security**
  - Apply consistent rate limits; throttle child-level mutation endpoints tighter (e.g., 30/minute) to prevent gaming the timer.
  - Audit log all parent-admin mutations (routines, tasks, rewards, redemptions) with Supabase `vault` or `pgmemento`.
- **Error Handling**
  - Return structured errors:
    ```json
    {
      "error": {
        "code": "string",
        "message": "Human readable",
        "details": {}
      }
    }
    ```
  - Map database constraint violations to `409 Conflict` or `422 Unprocessable Entity` as appropriate.
- **Performance**
  - Utilize indexes noted in schema for list endpoints; ensure pagination uses `created_at` order to remain index-friendly.
  - Implement ETag/`If-None-Match` for read-heavy endpoints (`/families/current`, `/families/{familyId}/progress`).
  - Provide `Cache-Control: private, max-age=30` for read endpoints safe to cache per user session.
