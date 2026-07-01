import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { AuthError, isAuthError } from "@/lib/auth/errors";
import { getPostLoginPath } from "@/lib/auth/roles";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  verifyEmailSchema,
  type PublicUser,
} from "@/lib/auth/schemas";
import {
  optionalAuthMiddleware,
  requireAuthMiddleware,
} from "@/auth/middleware";
import {
  getSessionUserFromToken,
  loginUser,
  registerUser,
  requestPasswordReset,
  resetPassword,
  revokeSessionByToken,
  verifyEmailToken,
  type SessionUser,
} from "@/auth/service";
import { clearSessionCookie, readSessionToken, setSessionCookie } from "@/auth/session";

function toPublicUser(user: SessionUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    emailVerified: user.emailVerified,
    roles: user.roles,
    status: user.status,
    lastSignupIntent: user.lastSignupIntent,
  };
}

function getRequestMeta() {
  const request = getRequest();
  return {
    ipAddress:
      request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      null,
    userAgent: request.headers.get("user-agent"),
  };
}

function rethrowAuth(error: unknown): never {
  if (isAuthError(error)) throw error;
  console.error(error);
  throw new AuthError("Произошла ошибка. Попробуйте ещё раз.", "VALIDATION");
}

export const getSessionFn = createServerFn({ method: "GET" })
  .middleware([optionalAuthMiddleware])
  .handler(async ({ context }) => {
    return context.user ? toPublicUser(context.user) : null;
  });

export const loginFn = createServerFn({ method: "POST" })
  .validator(loginSchema)
  .handler(async ({ data }) => {
    try {
      const meta = getRequestMeta();
      const session = await loginUser({
        email: data.email,
        password: data.password,
        remember: data.remember,
        ...meta,
      });
      setSessionCookie(session.token, data.remember);

      const user = await getSessionUserFromToken(session.token);
      if (!user) {
        throw new AuthError("Не удалось создать сессию.", "VALIDATION");
      }

      return {
        ok: true as const,
        user: toPublicUser(user),
        redirectTo: getPostLoginPath(user.roles),
      };
    } catch (error) {
      rethrowAuth(error);
    }
  });

export const signupFn = createServerFn({ method: "POST" })
  .validator(signupSchema)
  .handler(async ({ data }) => {
    try {
      await registerUser({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        signupRole: data.signupRole,
      });

      return {
        ok: true as const,
        message: "Аккаунт создан. Проверьте e-mail для подтверждения, затем войдите.",
      };
    } catch (error) {
      rethrowAuth(error);
    }
  });

export const logoutFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .handler(async () => {
    const token = readSessionToken();
    if (token) {
      await revokeSessionByToken(token);
    }
    clearSessionCookie();
    return { ok: true as const };
  });

export const forgotPasswordFn = createServerFn({ method: "POST" })
  .validator(forgotPasswordSchema)
  .handler(async ({ data }) => {
    try {
      await requestPasswordReset(data.email);
      return { ok: true as const };
    } catch (error) {
      rethrowAuth(error);
    }
  });

export const resetPasswordFn = createServerFn({ method: "POST" })
  .validator(resetPasswordSchema)
  .handler(async ({ data }) => {
    try {
      await resetPassword(data.token, data.password);
      return {
        ok: true as const,
        message: "Пароль обновлён. Теперь можно войти с новым паролем.",
      };
    } catch (error) {
      rethrowAuth(error);
    }
  });

export const verifyEmailFn = createServerFn({ method: "POST" })
  .validator(verifyEmailSchema)
  .handler(async ({ data }) => {
    try {
      await verifyEmailToken(data.token);
      return {
        ok: true as const,
        message: "E-mail подтверждён. Теперь можно войти.",
      };
    } catch (error) {
      rethrowAuth(error);
    }
  });

export const getCurrentUserFn = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }) => {
    return toPublicUser(context.user);
  });
