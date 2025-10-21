import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/db/database.types"
import type { FamilyDto, FamilyUpdateCommand } from "@/types"
import { mapSupabaseError, NotFoundError } from "../_lib/errors"

type Client = SupabaseClient<Database>

type FamilyRow = Database["public"]["Tables"]["families"]["Row"]

function mapFamily(row: FamilyRow): FamilyDto {
  return {
    id: row.id,
    familyName: row.family_name,
    timezone: row.timezone,
    settings: row.settings,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export async function getFamilyById(
  client: Client,
  familyId: string
): Promise<FamilyDto> {
  const { data, error } = await client
    .from("families")
    .select(
      `
        id,
        family_name,
        timezone,
        settings,
        created_at,
        updated_at,
        deleted_at
      `
    )
    .eq("id", familyId)
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  if (!data || data.deleted_at) {
    throw new NotFoundError("Family not found")
  }

  return mapFamily(data)
}

function buildUpdatePayload(
  command: FamilyUpdateCommand
): Database["public"]["Tables"]["families"]["Update"] {
  const payload: Database["public"]["Tables"]["families"]["Update"] = {}

  if (typeof command.familyName !== "undefined") {
    payload.family_name = command.familyName
  }

  if (typeof command.timezone !== "undefined") {
    payload.timezone = command.timezone
  }

  if (typeof command.settings !== "undefined") {
    payload.settings = command.settings
  }

  if (Object.keys(payload).length === 0) {
    return payload
  }

  payload.updated_at = new Date().toISOString()
  return payload
}

export async function updateFamily(
  client: Client,
  familyId: string,
  command: FamilyUpdateCommand
): Promise<FamilyDto> {
  const updatePayload = buildUpdatePayload(command)

  if (Object.keys(updatePayload).length === 0) {
    return getFamilyById(client, familyId)
  }

  const { data, error } = await client
    .from("families")
    .update(updatePayload)
    .eq("id", familyId)
    .select(
      `
        id,
        family_name,
        timezone,
        settings,
        created_at,
        updated_at,
        deleted_at
      `
    )
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  if (!data || data.deleted_at) {
    throw new NotFoundError("Family not found")
  }

  return mapFamily(data)
}
