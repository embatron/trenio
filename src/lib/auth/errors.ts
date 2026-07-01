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

export function authErrorMessage(error: unknown): string {
  if (isAuthError(error)) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Произошла ошибка. Попробуйте ещё раз.";
}
