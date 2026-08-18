export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "READ_ONLY_MODE"
  | "INTERNAL_ERROR";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | {
      success: false;
      error: { code: ErrorCode; message: string; fields?: Record<string, string[]> };
    };

export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

export function fail(
  code: ErrorCode,
  message: string,
  fields?: Record<string, string[]>,
): ActionResult<never> {
  return { success: false, error: { code, message, ...(fields ? { fields } : {}) } };
}
