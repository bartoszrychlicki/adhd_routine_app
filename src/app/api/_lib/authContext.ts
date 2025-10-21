import { headers } from "next/headers"
import { ForbiddenError, UnauthorizedError, ValidationError } from "./errors"
import type { Enums } from "@/db/database.types"
import type { Uuid } from "@/types"

type ProfileRole = Enums<"profile_role">

export type AuthContext = {
  profileId: Uuid
  familyId?: Uuid
  role: ProfileRole
}

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function parseUuid(value: string | null, field: string): Uuid | undefined {
  if (!value) {
    return undefined
  }

  if (!uuidRegex.test(value)) {
    throw new ValidationError(`Invalid UUID format for ${field}`, { value })
  }

  return value
}

function parseRole(value: string | null): ProfileRole {
  const fallbackRole: ProfileRole = "parent"
  if (!value) {
    return fallbackRole
  }

  if (value === "parent" || value === "child" || value === "admin") {
    return value
  }

  throw new ValidationError("Invalid role in auth context", { role: value })
}

export function requireAuthContext(): AuthContext {
  const hdrs = headers()
  const profileId = parseUuid(hdrs.get("x-debug-profile-id"), "profileId")

  if (!profileId) {
    throw new UnauthorizedError("Missing authentication context")
  }

  const familyId = parseUuid(hdrs.get("x-debug-family-id"), "familyId")
  const role = parseRole(hdrs.get("x-debug-role"))

  return {
    profileId,
    familyId,
    role
  }
}

export function assertFamilyAccess(
  context: AuthContext,
  familyId: Uuid
): void {
  if (context.familyId !== familyId) {
    throw new ForbiddenError("Cannot access another family")
  }
}

export function assertParentOrAdmin(context: AuthContext): void {
  if (context.role === "parent" || context.role === "admin") {
    return
  }

  throw new ForbiddenError("Insufficient role")
}
