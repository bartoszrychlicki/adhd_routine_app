import { NextResponse } from "next/server"
import type { PostgrestError } from "@supabase/supabase-js"

type ErrorDetails = Record<string, unknown> | undefined

export type ErrorResponseBody = {
  error: {
    code: string
    message: string
    details?: ErrorDetails
  }
}

export class HttpError extends Error {
  status: number
  code: string
  details?: ErrorDetails

  constructor(status: number, code: string, message: string, details?: ErrorDetails) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = "Unauthorized") {
    super(401, "unauthorized", message)
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = "Forbidden") {
    super(403, "forbidden", message)
  }
}

export class NotFoundError extends HttpError {
  constructor(message = "Not Found") {
    super(404, "not_found", message)
  }
}

export class ValidationError extends HttpError {
  constructor(message: string, details?: ErrorDetails) {
    super(400, "validation_error", message, details)
  }
}

export class ConflictError extends HttpError {
  constructor(message = "Conflict", details?: ErrorDetails) {
    super(409, "conflict", message, details)
  }
}

export function respondWithError(error: HttpError): Response {
  const body: ErrorResponseBody = {
    error: {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {})
    }
  }

  return NextResponse.json(body, { status: error.status })
}

export function handleRouteError(error: unknown): Response {
  if (error instanceof HttpError) {
    return respondWithError(error)
  }

  console.error("[api] unhandled error", error)

  const fallback = new HttpError(500, "internal_error", "Internal server error")
  return respondWithError(fallback)
}

export function mapSupabaseError(error: PostgrestError): HttpError {
  if (error.code === "PGRST116") {
    return new NotFoundError("Resource not found")
  }

  if (error.code === "23505") {
    return new ConflictError("Unique constraint violated", { hint: error.hint })
  }

  if (error.code === "23503") {
    return new ConflictError("Foreign key constraint violated", { hint: error.hint })
  }

  return new HttpError(500, "supabase_error", error.message, {
    code: error.code,
    details: error.details,
    hint: error.hint
  })
}
