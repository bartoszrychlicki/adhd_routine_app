import { randomBytes, scryptSync } from "crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/db/database.types"
import type {
  CreateChildProfileCommand,
  ProfileCreatedDto,
  ProfileListItemDto,
  ProfileSelfDto,
  ProfileUpdateCommand,
  ProfilesListResponseDto,
  ProfilePinUpdateCommand,
  PinUpdateResultDto
} from "@/types"
import {
  ForbiddenError,
  mapSupabaseError,
  NotFoundError,
  ValidationError
} from "../_lib/errors"
import type { AuthContext } from "../_lib/authContext"
import { deactivateActiveTokens } from "./tokensService"

type Client = SupabaseClient<Database>

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"]
type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"]

function mapProfile(row: ProfileRow): ProfileSelfDto {
  return {
    id: row.id,
    familyId: row.family_id,
    role: row.role,
    displayName: row.display_name,
    email: row.email,
    avatarUrl: row.avatar_url,
    settings: row.settings,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    pinLock: {
      failedAttempts: row.pin_failed_attempts,
      lockExpiresAt: row.pin_lock_expires_at
    }
  }
}

function mapProfileListItem(row: ProfileRow): ProfileListItemDto {
  return {
    id: row.id,
    role: row.role,
    displayName: row.display_name,
    email: row.email,
    avatarUrl: row.avatar_url,
    isDeleted: Boolean(row.deleted_at),
    lastLoginAt: row.last_login_at
  }
}

export async function getProfileById(
  client: Client,
  profileId: string
): Promise<ProfileSelfDto> {
  const { data, error } = await client
    .from("profiles")
    .select(
      `
        id,
        family_id,
        role,
        display_name,
        email,
        avatar_url,
        settings,
        last_login_at,
        created_at,
        pin_failed_attempts,
        pin_lock_expires_at,
        deleted_at
      `
    )
    .eq("id", profileId)
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  if (!data || data.deleted_at) {
    throw new NotFoundError("Profile not found")
  }

  return mapProfile(data)
}

type ListProfilesOptions = {
  familyId: string
  role?: string
  includeDeleted: boolean
  limit: number
  offset: number
  sort: "created_at" | "display_name"
  order: "asc" | "desc"
}

export async function listProfiles(
  client: Client,
  options: ListProfilesOptions
): Promise<ProfilesListResponseDto> {
  const query = client
    .from("profiles")
    .select(
      `
        id,
        family_id,
        role,
        display_name,
        email,
        avatar_url,
        last_login_at,
        deleted_at
      `,
      { count: "exact" }
    )
    .eq("family_id", options.familyId)
    .order(options.sort, { ascending: options.order === "asc" })
    .limit(options.limit)
    .range(options.offset, options.offset + options.limit - 1)

  if (options.role) {
    query.eq("role", options.role)
  }

  if (!options.includeDeleted) {
    query.is("deleted_at", null)
  }

  const { data, error, count } = await query

  if (error) {
    throw mapSupabaseError(error)
  }

  return {
    data: data.map((row) => mapProfileListItem(row as ProfileRow)),
    meta: {
      page: Math.floor(options.offset / options.limit) + 1,
      pageSize: options.limit,
      total: count ?? undefined
    }
  }
}

function hashPin(pin: string): string {
  if (!/^\d{4,6}$/.test(pin)) {
    throw new ValidationError("PIN must be 4-6 digits")
  }

  const salt = randomBytes(16)
  const hash = scryptSync(pin, salt, 64)
  return `${salt.toString("hex")}:${hash.toString("hex")}`
}

function buildInsertPayload(
  familyId: string,
  command: CreateChildProfileCommand
): ProfileInsert {
  const payload: ProfileInsert = {
    family_id: familyId,
    role: "child",
    display_name: command.displayName,
    email: command.email ?? null,
    avatar_url: command.avatarUrl ?? null,
    settings: command.settings ?? {},
    pin_failed_attempts: 0,
    pin_lock_expires_at: null
  }

  if (command.pin) {
    payload.pin_hash = hashPin(command.pin)
  }

  return payload
}

export async function createChildProfile(
  client: Client,
  familyId: string,
  command: CreateChildProfileCommand
): Promise<ProfileCreatedDto> {
  const payload = buildInsertPayload(familyId, command)

  const { data, error } = await client
    .from("profiles")
    .insert(payload)
    .select(
      `
        id,
        family_id,
        role,
        display_name,
        email,
        avatar_url,
        created_at
      `
    )
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  if (!data) {
    throw new NotFoundError("Profile creation failed")
  }

  return {
    id: data.id,
    familyId: data.family_id,
    role: data.role,
    displayName: data.display_name,
    email: data.email,
    avatarUrl: data.avatar_url,
    createdAt: data.created_at
  }
}

function buildProfileUpdatePayload(
  command: ProfileUpdateCommand
): Database["public"]["Tables"]["profiles"]["Update"] {
  const payload: Database["public"]["Tables"]["profiles"]["Update"] = {}

  if (typeof command.displayName !== "undefined") {
    payload.display_name = command.displayName
  }

  if (typeof command.avatarUrl !== "undefined") {
    payload.avatar_url = command.avatarUrl
  }

  if (typeof command.settings !== "undefined") {
    payload.settings = command.settings
  }

  if (typeof command.deletedAt !== "undefined") {
    payload.deleted_at = command.deletedAt
  }

  if (Object.keys(payload).length > 0) {
    payload.updated_at = new Date().toISOString()
  }

  return payload
}

export async function updateProfile(
  client: Client,
  profileId: string,
  command: ProfileUpdateCommand
): Promise<void> {
  const payload = buildProfileUpdatePayload(command)

  if (Object.keys(payload).length === 0) {
    return
  }

  const { error } = await client
    .from("profiles")
    .update(payload)
    .eq("id", profileId)

  if (error) {
    throw mapSupabaseError(error)
  }
}

async function fetchProfileRow(
  client: Client,
  profileId: string
): Promise<ProfileRow> {
  const { data, error } = await client
    .from("profiles")
    .select(
      `
        id,
        family_id,
        role,
        pin_failed_attempts,
        pin_lock_expires_at,
        deleted_at
      `
    )
    .eq("id", profileId)
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  if (!data || data.deleted_at) {
    throw new NotFoundError("Profile not found")
  }

  return data
}

export async function updateProfilePin(
  client: Client,
  context: AuthContext,
  profileId: string,
  command: ProfilePinUpdateCommand
): Promise<PinUpdateResultDto> {
  const profile = await fetchProfileRow(client, profileId)

  if (profile.role !== "child") {
    throw new ValidationError("PIN can only be set for child profiles")
  }

  if (
    context.role !== "parent" &&
    context.role !== "admin" &&
    context.profileId !== profileId
  ) {
    throw new ForbiddenError("Insufficient permissions to update PIN")
  }

  const pinHash = hashPin(command.pin)

  const { data, error } = await client
    .from("profiles")
    .update({
      pin_hash: pinHash,
      pin_failed_attempts: 0,
      pin_lock_expires_at: null,
      updated_at: new Date().toISOString()
    })
    .eq("id", profileId)
    .select(
      `
        pin_failed_attempts,
        pin_lock_expires_at
      `
    )
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  if (command.rotateTokens) {
    await deactivateActiveTokens(client, profileId, context.profileId)
  }

  return {
    message: "PIN updated",
    pinLock: {
      failedAttempts: data?.pin_failed_attempts ?? 0,
      lockExpiresAt: data?.pin_lock_expires_at ?? null
    }
  }
}

export async function ensureProfileInFamily(
  client: Client,
  profileId: string,
  familyId: string
): Promise<ProfileRow> {
  const profile = await fetchProfileRow(client, profileId)
  if (profile.family_id !== familyId) {
    throw new ConflictError("Profile does not belong to this family")
  }

  return profile
}
