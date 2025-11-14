import { randomBytes } from "crypto"
import type { Database } from "@/db/database.types"
import type {
  ChildAccessTokenCreateCommand,
  ChildAccessTokenDeactivateResultDto,
  ChildAccessTokenDto,
  ChildAccessTokenListDto
} from "@/types"
import {
  ForbiddenError,
  mapSupabaseError,
  NotFoundError
} from "../_lib/errors"
import type { AppSupabaseClient } from "../_lib/types"

type Client = AppSupabaseClient

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"]
type ChildProfileRow = Pick<ProfileRow, "id" | "role" | "deleted_at">

function generateToken(): string {
  return randomBytes(24).toString("base64url")
}

async function getChildProfile(
  client: Client,
  profileId: string
): Promise<ChildProfileRow> {
  const { data, error } = await client
    .from("profiles")
    .select(`id, role, deleted_at`)
    .eq("id", profileId)
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  if (!data || data.deleted_at) {
    throw new NotFoundError("Profile not found")
  }

  if (data.role !== "child") {
    throw new ForbiddenError("Tokens can only be issued for child profiles")
  }

  return data as ChildProfileRow
}

export async function deactivateActiveTokens(
  client: Client,
  profileId: string,
  actorProfileId: string
): Promise<void> {
  const { error } = await client
    .from("child_access_tokens")
    .update({
      deactivated_at: new Date().toISOString(),
      deactivated_by_profile_id: actorProfileId
    })
    .eq("profile_id", profileId)
    .is("deactivated_at", null)

  if (error) {
    throw mapSupabaseError(error)
  }
}

export async function createChildAccessToken(
  client: Client,
  profileId: string,
  actorProfileId: string,
  command: ChildAccessTokenCreateCommand
): Promise<ChildAccessTokenDto> {
  await getChildProfile(client, profileId)
  await deactivateActiveTokens(client, profileId, actorProfileId)

  const now = new Date().toISOString()
  const tokenValue = generateToken()

  const { data, error } = await client
    .from("child_access_tokens")
    .insert({
      profile_id: profileId,
      token: tokenValue,
      created_by_profile_id: actorProfileId,
      created_at: now,
      metadata: command.metadata ?? {}
    })
    .select(`id, profile_id, token, created_at, last_used_at, deactivated_at`)
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  if (!data) {
    throw new NotFoundError("Failed to create access token")
  }

  return {
    id: data.id,
    profileId: data.profile_id,
    token: data.token,
    createdAt: data.created_at,
    lastUsedAt: data.last_used_at,
    deactivatedAt: data.deactivated_at
  }
}

export async function listChildAccessTokens(
  client: Client,
  profileId: string,
  includeInactive: boolean
): Promise<ChildAccessTokenListDto> {
  await getChildProfile(client, profileId)

  const query = client
    .from("child_access_tokens")
    .select(`id, profile_id, token, created_at, last_used_at, deactivated_at`)
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })

  if (!includeInactive) {
    query.is("deactivated_at", null)
  }

  const { data, error } = await query

  if (error) {
    throw mapSupabaseError(error)
  }

  return {
    data: data.map((row) => ({
      id: row.id,
      profileId: row.profile_id,
      token: row.token,
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
      deactivatedAt: row.deactivated_at
    }))
  }
}

export async function deactivateToken(
  client: Client,
  profileId: string,
  tokenId: string,
  actorProfileId: string
): Promise<ChildAccessTokenDeactivateResultDto> {
  const { data, error } = await client
    .from("child_access_tokens")
    .update({
      deactivated_at: new Date().toISOString(),
      deactivated_by_profile_id: actorProfileId
    })
    .eq("id", tokenId)
    .eq("profile_id", profileId)
    .is("deactivated_at", null)
    .select("id, deactivated_at")
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  if (!data) {
    throw new NotFoundError("Token not found or already inactive")
  }

  return {
    message: "Token deactivated",
    deactivatedAt: data.deactivated_at ?? null
  }
}

export async function hasActiveToken(
  client: Client,
  profileId: string
): Promise<boolean> {
  const { error, count } = await client
    .from("child_access_tokens")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .is("deactivated_at", null)

  if (error) {
    throw mapSupabaseError(error)
  }

  return typeof count === "number" && count > 0
}
