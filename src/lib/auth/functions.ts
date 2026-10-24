import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { AuthError, isAuthError } from "@/lib/auth/errors";
import { getPostLoginPath } from "@/lib/auth/roles";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  smsConfirmSchema,
  smsRequestSchema,
  smsResetSchema,
  telegramWebAppSchema,
  telegramWidgetSchema,
  accountAvatarSchema,
  changePasswordSchema,
  accountEmailCodeSchema,
  accountEmailSchema,
  accountPhoneCodeSchema,
  accountPhoneSchema,
  profileNameSchema,
  verifyEmailSchema,
  type PublicUser,
} from "@/lib/auth/schemas";
import {
  optionalAuthMiddleware,
  requireAuthMiddleware,
} from "@/auth/middleware";
import {
  confirmPasswordResetByPhone,
  confirmSmsLogin,
  consumeForgotEmailLimit,
  consumePasswordLoginLimit,
  loginWithTelegramWebApp,
  loginWithTelegramWidget,
  requestPasswordResetByPhone,
  requestSmsLogin,
} from "@/auth/login-channels";
import { getTelegramLoginConfig } from "@/auth/telegram";
import {
  getSessionUserFromToken,
  loginUser,
  registerUser,
  requestPasswordReset,
  changeAccountPassword,
  confirmAccountEmailCode,
  confirmAccountPhoneCode,
  requestAccountEmailCode,
  requestAccountPhoneCode,
  setAccountAvatar,
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
    avatarPath: user.avatarPath,
    emailVerified: user.emailVerified,
    roles: user.roles,
    status: user.status,
    lastSignupIntent: user.lastSignupIntent,
  };
}

function getRequestMeta() {
  const request = getRequest();
  const ipAddress =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;
  return {
    ipAddress,
    userAgent: request.headers.get("user-agent"),
    clientKey: ipAddress ?? "local",
  };
}

async function finishLogin(
  session: { token: string },
  remember = true,
) {
  setSessionCookie(session.token, remember);
  const user = await getSessionUserFromToken(session.token);
  if (!user) {
    throw new AuthError("Не удалось создать сессию.", "VALIDATION");
  }
  return {
    ok: true as const,
    user: toPublicUser(user),
    redirectTo: getPostLoginPath(user.roles),
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
      if (data.honeypot?.trim()) {
        throw new AuthError("Неверный логин или пароль.", "INVALID_CREDENTIALS");
      }
      const meta = getRequestMeta();
      consumePasswordLoginLimit(data.email, meta.clientKey);
      const session = await loginUser({
        email: data.email,
        password: data.password,
        remember: data.remember,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      return finishLogin(session, data.remember);
    } catch (error) {
      rethrowAuth(error);
    }
  });

export const requestSmsLoginFn = createServerFn({ method: "POST" })
  .validator(smsRequestSchema)
  .handler(async ({ data }) => {
    try {
      return await requestSmsLogin(data.phone, { ...getRequestMeta(), honeypot: data.honeypot });
    } catch (error) {
      rethrowAuth(error);
    }
  });

export const confirmSmsLoginFn = createServerFn({ method: "POST" })
  .validator(smsConfirmSchema)
  .handler(async ({ data }) => {
    try {
      const session = await confirmSmsLogin(data.phone, data.code, {
        ...getRequestMeta(),
        honeypot: data.honeypot,
      });
      return finishLogin(session);
    } catch (error) {
      rethrowAuth(error);
    }
  });

export const loginWithTelegramFn = createServerFn({ method: "POST" })
  .validator(telegramWidgetSchema)
  .handler(async ({ data }) => {
    try {
      const session = await loginWithTelegramWidget(data, {
        ...getRequestMeta(),
        honeypot: data.honeypot,
      });
      return finishLogin(session);
    } catch (error) {
      rethrowAuth(error);
    }
  });

export const loginWithTelegramWebAppFn = createServerFn({ method: "POST" })
  .validator(telegramWebAppSchema)
  .handler(async ({ data }) => {
    try {
      const session = await loginWithTelegramWebApp(data.initData, {
        ...getRequestMeta(),
        honeypot: data.honeypot,
      });
      return finishLogin(session);
    } catch (error) {
      rethrowAuth(error);
    }
  });

export const getTelegramLoginConfigFn = createServerFn({ method: "GET" }).handler(async () => {
  return getTelegramLoginConfig();
});

export const requestPasswordResetSmsFn = createServerFn({ method: "POST" })
  .validator(smsRequestSchema)
  .handler(async ({ data }) => {
    try {
      return await requestPasswordResetByPhone(data.phone, {
        ...getRequestMeta(),
        honeypot: data.honeypot,
      });
    } catch (error) {
      rethrowAuth(error);
    }
  });

export const confirmPasswordResetSmsFn = createServerFn({ method: "POST" })
  .validator(smsResetSchema)
  .handler(async ({ data }) => {
    try {
      const session = await confirmPasswordResetByPhone(
        { phone: data.phone, code: data.code, password: data.password },
        { ...getRequestMeta(), honeypot: data.honeypot },
      );
      return finishLogin(session);
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
      if (!data.honeypot?.trim()) {
        consumeForgotEmailLimit(getRequestMeta().clientKey);
        await requestPasswordReset(data.email);
      }
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

export const confirmEmailChangeFn = createServerFn({ method: "POST" })
  .validator(verifyEmailSchema)
  .handler(async () => {
    throw new AuthError("Ссылка недействительна или устарела.", "INVALID_TOKEN");
  });

export const requestAccountEmailCodeFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(accountEmailSchema)
  .handler(async ({ data, context }) => {
    try {
      return await requestAccountEmailCode(context.user.id, data.email);
    } catch (error) {
      rethrowAuth(error);
    }
  });

export const confirmAccountEmailCodeFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(accountEmailCodeSchema)
  .handler(async ({ data, context }) => {
    try {
      return await confirmAccountEmailCode(context.user.id, data.email, data.code);
    } catch (error) {
      rethrowAuth(error);
    }
  });

export const requestAccountPhoneCodeFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(accountPhoneSchema)
  .handler(async ({ data, context }) => {
    try {
      return await requestAccountPhoneCode(context.user.id, data.phone);
    } catch (error) {
      rethrowAuth(error);
    }
  });

export const confirmAccountPhoneCodeFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(accountPhoneCodeSchema)
  .handler(async ({ data, context }) => {
    try {
      return await confirmAccountPhoneCode(context.user.id, data.phone, data.code);
    } catch (error) {
      rethrowAuth(error);
    }
  });

export const changePasswordFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(changePasswordSchema)
  .handler(async ({ data, context }) => {
    try {
      return await changeAccountPassword(
        context.user.id,
        data.currentPassword,
        data.newPassword,
        readSessionToken(),
      );
    } catch (error) {
      rethrowAuth(error);
    }
  });

export const setAccountAvatarFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(accountAvatarSchema)
  .handler(async ({ data, context }) => {
    try {
      return await setAccountAvatar(context.user.id, data.image);
    } catch (error) {
      rethrowAuth(error);
    }
  });

export const updateProfileFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(profileNameSchema)
  .handler(async ({ data, context }) => {
    try {
      await updateAccountName(context.user.id, data.firstName, data.lastName);
      return { ok: true as const };
    } catch (error) {
      rethrowAuth(error);
    }
  });

export const getCurrentUserFn = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }) => {
    return toPublicUser(context.user);
  });
