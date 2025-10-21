import { ValidationError } from "./errors"

export async function readJsonBody<T = unknown>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T
  } catch (error) {
    throw new ValidationError("Invalid JSON payload", {
      cause: error instanceof Error ? error.message : error
    })
  }
}
