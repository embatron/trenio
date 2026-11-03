import { AUTHORIZATION_REQUIRED, redirectToLogin } from "@/lib/auth/return-path";

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

function readMessage(error: unknown): string {
  if (isAuthError(error) || error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof (error as { message: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return "";
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

/** The session is missing. Callers send the person to the login page instead of showing this sentence. */
export function isAuthorizationRequired(error: unknown): boolean {
  const raw = readMessage(error).trim();
  const issue = raw ? firstIssueMessage(raw) : null;
  return (issue ?? raw) === AUTHORIZATION_REQUIRED;
}

export function authErrorMessage(error: unknown): string {
  if (error instanceof Error && error.name === "StepUpCancelled") return "";
  if (isAuthorizationRequired(error)) {
    if (redirectToLogin()) return "";
    return AUTHORIZATION_REQUIRED;
  }
  if (isAuthError(error)) return error.message;
  const raw = readMessage(error);
  const issue = raw ? firstIssueMessage(raw) : null;
  if (issue) return issue;
  if (raw && !raw.trim().startsWith("[") && !raw.trim().startsWith("{")) return raw;
  return "Произошла ошибка. Попробуйте ещё раз.";
}
