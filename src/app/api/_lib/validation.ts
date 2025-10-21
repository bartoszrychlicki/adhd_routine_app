import { ValidationError } from "./errors"

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function ensureUuid(value: string, fieldName: string): string {
  if (!uuidRegex.test(value)) {
    throw new ValidationError(`Invalid UUID for ${fieldName}`, { value })
  }
  return value
}

export function parseBoolean(
  value: string | null | undefined,
  fallback: boolean
): boolean {
  if (value === null || typeof value === "undefined" || value.trim() === "") {
    return fallback
  }

  if (value === "true") {
    return true
  }
  if (value === "false") {
    return false
  }

  throw new ValidationError("Invalid boolean value", { value })
}

export function parseNumber(
  value: string | null | undefined,
  options: { min?: number; max?: number; fallback: number }
): number {
  if (value === null || typeof value === "undefined" || value.trim() === "") {
    return options.fallback
  }

  const parsed = Number(value)

  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new ValidationError("Invalid numeric value", { value })
  }

  if (typeof options.min === "number" && parsed < options.min) {
    throw new ValidationError("Numeric value below minimum", {
      min: options.min,
      value: parsed
    })
  }

  if (typeof options.max === "number" && parsed > options.max) {
    throw new ValidationError("Numeric value above maximum", {
      max: options.max,
      value: parsed
    })
  }

  return parsed
}
