export class AuthError extends Error {
  constructor(
    message: string,
    public code:
      | "INVALID_CREDENTIALS"
      | "EMAIL_TAKEN"
      | "PHONE_TAKEN"
      | "WEAK_PASSWORD"
      | "UNAUTHORIZED"
      | "FORBIDDEN"
      | "INVALID_TOKEN"
      | "EXPIRED_TOKEN"
      | "ACCOUNT_SUSPENDED"
      | "RATE_LIMITED"
      | "VALIDATION",
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}

function firstIssueMessage(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed) as { message?: unknown } | Array<{ message?: unknown }>;
    const issues = Array.isArray(parsed) ? parsed : [parsed];
    const message = issues.find((issue) => typeof issue.message === "string" && issue.message.trim())?.message;
    return typeof message === "string" ? message : null;
  } catch {
    return null;
  }
}

export function authErrorMessage(error: unknown): string {
  if (isAuthError(error)) return error.message;
  const raw = error instanceof Error ? error.message : "";
  const issue = raw ? firstIssueMessage(raw) : null;
  if (issue) return issue;
  if (raw && !raw.trim().startsWith("[") && !raw.trim().startsWith("{")) return raw;
  return "Произошла ошибка. Попробуйте ещё раз.";
}
