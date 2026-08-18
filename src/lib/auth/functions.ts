import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { clientIpFromHeaders } from "@/auth/request-meta";
import { AuthError, isAuthError } from "@/lib/auth/errors";
import { getPostLoginPath } from "@/lib/auth/roles";
import {
  confirmEmailSchema,
  confirmPhoneVerifySchema,
  confirmSmsSchema,
  forgotPasswordSchema,
  loginSchema,
  requestEmailChangeSchema,
  requestPhoneVerifySchema,
  requestSmsSchema,
  resetPasswordSchema,
  setPasswordSchema,
  signupSchema,
  updateNameSchema,
  verifyEmailSchema,
  type PublicUser,
} from "@/lib/auth/schemas";
import {
  optionalAuthMiddleware,
  requireAuthMiddleware,
} from "@/auth/middleware";
import {
  buildSessionUser,
  completeSetPassword,
  confirmEmailChange,
  confirmPhoneVerify,
  confirmSmsLogin,
  getSessionUserFromToken,
  loginUser,
  registerUser,
  requestEmailChange,
  requestPasswordReset,
  requestPhoneVerify,
  requestSmsLogin,
  resetPassword,
  revokeSessionByToken,
  updateAccountName,
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
    phone: user.phone,
    phoneVerified: user.phoneVerified,
    emailVerified: user.emailVerified,
    roles: user.roles,
    status: user.status,
    lastSignupIntent: user.lastSignupIntent,
  };
}

function getRequestMeta() {
  const request = getRequest();
  return {
    ipAddress: clientIpFromHeaders(request.headers.get("x-real-ip")),
    userAgent: request.headers.get("user-agent"),
  };
}

function rethrowAuth(error: unknown): never {
  if (isAuthError(error)) throw error;
  console.error(error);
  throw new AuthError("Произошла ошибка. Попробуйте ещё раз.", "VALIDATION");
}

async function sessionResponse(token: string, remember = true) {
  setSessionCookie(token, remember);
  const user = await getSessionUserFromToken(token);
  if (!user) {
    throw new AuthError("Не удалось создать сессию.", "VALIDATION");
  }
  return {
    ok: true as const,
    user: toPublicUser(user),
    redirectTo: getPostLoginPath(user.roles),
  };
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
        honeypot: data.company_url,
        ...meta,
      });
      return sessionResponse(session.token, data.remember);
    } catch (error) {
      rethrowAuth(error);
    }
  });

export const requestSmsLoginFn = createServerFn({ method: "POST" })
  .validator(requestSmsSchema)
  .handler(async ({ data }) => {
    try {
      return await requestSmsLogin(data.phone, {
        ...getRequestMeta(),
        honeypot: data.company_url,
      });
    } catch (error) {
      rethrowAuth(error);
    }
  });

export const confirmSmsLoginFn = createServerFn({ method: "POST" })
  .validator(confirmSmsSchema)
  .handler(async ({ data }) => {
    try {
      const meta = getRequestMeta();
      const session = await confirmSmsLogin({
        phone: data.phone,
        code: data.code,
        remember: data.remember,
        honeypot: data.company_url,
        ...meta,
      });
      return sessionResponse(session.token, data.remember);
    } catch (error) {
      rethrowAuth(error);
    }
  });

export const signupFn = createServerFn({ method: "POST" })
  .validator(signupSchema)
  .handler(async ({ data }) => {
    try {
      const result = await registerUser({
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        signupRole: data.signupRole,
        honeypot: data.company_url,
        ipAddress: getRequestMeta().ipAddress,
      });
      return { ok: true as const, ...result };
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
      await requestPasswordReset(data.email, {
        ...getRequestMeta(),
        honeypot: data.company_url,
      });
      return { ok: true as const };
    } catch (error) {
      rethrowAuth(error);
    }
  });

export const resetPasswordFn = createServerFn({ method: "POST" })
  .validator(resetPasswordSchema)
  .handler(async ({ data }) => {
    try {
      const session = await resetPassword(data.token, data.password, getRequestMeta());
      return sessionResponse(session.token, true);
    } catch (error) {
      rethrowAuth(error);
    }
  });

export const setPasswordFn = createServerFn({ method: "POST" })
  .validator(setPasswordSchema)
  .handler(async ({ data }) => {
    try {
      const session = await completeSetPassword(data.token, data.password);
      setSessionCookie(session.token, true);
      const user = await getSessionUserFromToken(session.token);
      if (!user) {
        throw new AuthError("Не удалось создать сессию.", "VALIDATION");
      }
      return {
        ok: true as const,
        user: toPublicUser(user),
        redirectTo: "/account",
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

export const confirmEmailChangeFn = createServerFn({ method: "POST" })
  .validator(confirmEmailSchema)
  .handler(async ({ data }) => {
    try {
      const userId = await confirmEmailChange(data.token);
      const user = await buildSessionUser(userId);
      return {
        ok: true as const,
        user: user ? toPublicUser(user) : null,
        redirectTo: "/account",
      };
    } catch (error) {
      rethrowAuth(error);
    }
  });

export const requestEmailChangeFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(requestEmailChangeSchema)
  .handler(async ({ context, data }) => {
    try {
      return {
        ok: true as const,
        ...(await requestEmailChange(context.user.id, data.email, getRequestMeta())),
      };
    } catch (error) {
      rethrowAuth(error);
    }
  });

export const updateNameFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(updateNameSchema)
  .handler(async ({ context, data }) => {
    try {
      await updateAccountName(context.user.id, data.firstName, data.lastName);
      const user = await buildSessionUser(context.user.id);
      return { ok: true as const, user: user ? toPublicUser(user) : null };
    } catch (error) {
      rethrowAuth(error);
    }
  });

export const requestPhoneVerifyFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(requestPhoneVerifySchema)
  .handler(async ({ context, data }) => {
    try {
      return {
        ok: true as const,
        ...(await requestPhoneVerify(context.user.id, data.phone, {
          ...getRequestMeta(),
          honeypot: data.company_url,
        })),
      };
    } catch (error) {
      rethrowAuth(error);
    }
  });

export const confirmPhoneVerifyFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(confirmPhoneVerifySchema)
  .handler(async ({ context, data }) => {
    try {
      await confirmPhoneVerify(context.user.id, data.phone, data.code, data.company_url);
      const user = await buildSessionUser(context.user.id);
      return { ok: true as const, user: user ? toPublicUser(user) : null };
    } catch (error) {
      rethrowAuth(error);
    }
  });

export const getCurrentUserFn = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }) => {
    return toPublicUser(context.user);
  });
