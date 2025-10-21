import type { FamilyUpdateCommand } from "@/types"
import { ValidationError } from "../_lib/errors"

type FamilyUpdatePayload = Pick<
  FamilyUpdateCommand,
  "familyName" | "timezone" | "settings"
>

const timezoneSet = (() => {
  if (typeof Intl !== "undefined" && "supportedValuesOf" in Intl) {
    try {
      const zones = (Intl as typeof Intl & {
        supportedValuesOf?: (input: string) => string[]
      }).supportedValuesOf?.("timeZone")
      if (Array.isArray(zones)) {
        return new Set(zones)
      }
    } catch {
      // ignore – fallback below
    }
  }

  return undefined
})()

function validateTimezone(value: unknown): string | undefined {
  if (typeof value === "undefined") {
    return undefined
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError("Timezone must be a non-empty string")
  }

  if (timezoneSet && !timezoneSet.has(value)) {
    throw new ValidationError("Timezone must be a valid IANA name", {
      timezone: value
    })
  }

  return value
}

function validateFamilyName(value: unknown): string | undefined {
  if (typeof value === "undefined") {
    return undefined
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError("familyName must be a non-empty string")
  }

  return value
}

function validateSettings(value: unknown): FamilyUpdateCommand["settings"] {
  if (typeof value === "undefined") {
    return undefined
  }

  if (value === null) {
    return null
  }

  if (typeof value === "object") {
    return value as FamilyUpdateCommand["settings"]
  }

  throw new ValidationError("settings must be an object or null")
}

export function parseFamilyUpdatePayload(
  payload: unknown
): FamilyUpdatePayload {
  if (typeof payload !== "object" || payload === null) {
    throw new ValidationError("Request body must be a JSON object")
  }

  const record = payload as Record<string, unknown>

  const familyName = validateFamilyName(record.familyName)
  const timezone = validateTimezone(record.timezone)
  const settings = validateSettings(record.settings)

  if (
    typeof familyName === "undefined" &&
    typeof timezone === "undefined" &&
    typeof settings === "undefined"
  ) {
    throw new ValidationError("At least one field must be provided for update")
  }

  return {
    familyName,
    timezone,
    settings
  }
}
