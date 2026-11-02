import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { AuthError, isAuthError } from "@/lib/auth/errors";
import { getPostLoginPath, hasAnyRole } from "@/lib/auth/roles";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupCredentialsSchema,
  signupSchema,
  smsConfirmSchema,
  smsRequestSchema,
  smsResetSchema,
  telegramWebAppSchema,
  telegramWidgetSchema,
  trainerTelegramPhoneSchema,
  trainerTelegramWebAppSchema,
  accountAvatarSchema,
  changePasswordSchema,
  deleteAccountSchema,
  accountEmailCodeSchema,
  accountEmailSchema,
  accountPhoneCodeSchema,
  accountPhoneSchema,
  mailPreferenceSchema,
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
  confirmSmsSignup,
  requestSmsSignup,
  saveSignupCredentials,
  signupWithEmail,
  signupWithTelegramWebApp,
  signupWithTelegramWidget,
} from "@/auth/signup-channels";
import { isPendingSignupEmail } from "@/lib/auth/pending-email";
import {
  getSessionUserFromToken,
  loginUser,
  trainerHeaderFace,
  requestPasswordReset,
  changeAccountPassword,
  confirmAccountEmailCode,
  confirmAccountPhoneCode,
  confirmTrainerContactEmailCode,
  confirmTrainerPhoneFromTelegram,
  confirmTrainerTelegram,
  confirmTrainerTelegramWebApp,
  linkAccountTelegram,
  linkAccountTelegramWebApp,
  unlinkAccountTelegram,
  requestAccountEmailCode,
  requestAccountPhoneCode,
  requestTrainerContactEmailCode,
  setAccountAvatar,
  resetPassword,
  setPasswordFromEmailLink,
  revokeSessionByToken,
  updateAccountName,
  updateMailPreference,
  verifyEmailToken,
  type SessionUser,
} from "@/auth/service";
import { deleteOwnAccount, restoreOwnAccount } from "@/lib/account/delete-account";
import { clearSessionCookie, readSessionToken, setSessionCookie } from "@/auth/session";
import { writeLog, maskPhone } from "@/lib/log/logger";
import type { LogOutcome } from "@/lib/log/policy";

function toPublicUser(user: SessionUser): PublicUser {
  const needsCredentials = isPendingSignupEmail(user.email);
  return {
    id: user.id,
    email: needsCredentials ? "" : user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarPath: user.avatarPath,
    nick: "",
    emailVerified: needsCredentials ? false : user.emailVerified,
    needsCredentials,
    needsDoorPassword: user.needsPassword && user.lastSignupIntent === "trainer_claim",
    roles: user.roles,
    status: user.status,
    lastSignupIntent: user.lastSignupIntent,
    mailMessages: user.mailMessages,
    mailReviews: user.mailReviews,
    mailSite: user.mailSite,
    mailMarketing: user.mailMarketing,
    telegramLinked: user.telegramLinked,
    telegramUsername: user.telegramUsername,
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
  action = "auth.login",
  message = "Вход выполнен.",
) {
  setSessionCookie(session.token, remember);
  const user = await getSessionUserFromToken(session.token);
  if (!user) {
    throw new AuthError("Не удалось создать сессию.", "VALIDATION");
  }
  void writeLog({
    level: "info",
    domain: action.startsWith("account.") ? "account" : "auth",
    action,
    outcome: "success",
    message,
    subject: isPendingSignupEmail(user.email) ? null : user.email,
    actorUserId: user.id,
  });
  return {
    ok: true as const,
    user: toPublicUser(user),
    redirectTo: getPostLoginPath(user.roles),
  };
}

function rethrowAuth(
  error: unknown,
  action: string,
  subject?: string | null,
  actorUserId?: string | null,
  outcome?: LogOutcome,
): never {
  const denied =
    outcome === "denied" ||
    (isAuthError(error) &&
      (error.code === "FORBIDDEN" || error.code === "RATE_LIMITED" || error.code === "UNAUTHORIZED" || error.code === "ACCOUNT_SUSPENDED"));
  void writeLog({
    level: isAuthError(error) ? "warn" : "error",
    domain: action.startsWith("account.") ? "account" : "auth",
    action,
    outcome: denied ? "denied" : "failure",
    message: isAuthError(error) ? error.message : "Сбой входа или аккаунта.",
    subject,
    actorUserId,
    error,
  });
  if (isAuthError(error)) throw error;
  throw new AuthError("Произошла ошибка. Попробуйте ещё раз.", "VALIDATION");
}

export const getSessionFn = createServerFn({ method: "GET" })
  .middleware([optionalAuthMiddleware])
  .handler(async ({ context }) => {
    if (!context.user) return null;
    const user = toPublicUser(context.user);
    if (!hasAnyRole(context.user.roles, ["trainer", "club"])) return user;
    const face = await trainerHeaderFace(context.user.id);
    if (!face) return user;
    return { ...user, nick: face.nick, avatarPath: face.avatarPath || user.avatarPath };
  });

function logChannel(action: string, phone: string, result: unknown) {
  const failed = Boolean(result && typeof result === "object" && "ok" in result && (result as { ok?: boolean }).ok === false);
  const rawCode = result && typeof result === "object" && "code" in result ? (result as { code?: unknown }).code : null;
  const errorCode = typeof rawCode === "string" && !/^\d+$/.test(rawCode) ? rawCode : null;
  void writeLog({
    level: failed ? "warn" : "info",
    domain: "auth",
    action,
    outcome: failed ? "failure" : "success",
    message: failed ? "Код не отправлен." : "Код запрошен.",
    subject: maskPhone(phone),
    errorCode,
  });
}

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
      if ("restore" in session) {
        void writeLog({
          level: "info",
          domain: "auth",
          action: "auth.login",
          outcome: "skipped",
          message: "Аккаунт удалён. Предложено восстановление.",
          subject: session.email,
          actorUserId: session.userId,
        });
        return { ok: true as const, restore: true as const };
      }
      return finishLogin(session, data.remember, "auth.login");
    } catch (error) {
      rethrowAuth(error, "auth.login", data.email, null, data.honeypot?.trim() ? "denied" : undefined);
    }
  });

export const requestSmsLoginFn = createServerFn({ method: "POST" })
  .validator(smsRequestSchema)
  .handler(async ({ data }) => {
    try {
      const result = await requestSmsLogin(data.phone, { ...getRequestMeta(), honeypot: data.honeypot });
      logChannel("auth.sms.request", data.phone, result);
      return result;
    } catch (error) {
      rethrowAuth(error, "auth.sms.request", maskPhone(data.phone));
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
      return finishLogin(session, true, "auth.sms.confirm");
    } catch (error) {
      rethrowAuth(error, "auth.sms.confirm", maskPhone(data.phone));
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
      return finishLogin(session, true, "auth.telegram");
    } catch (error) {
      rethrowAuth(error, "auth.telegram");
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
      return finishLogin(session, true, "auth.telegram.webapp");
    } catch (error) {
      rethrowAuth(error, "auth.telegram.webapp");
    }
  });

export const getTelegramLoginConfigFn = createServerFn({ method: "GET" }).handler(async () => {
  return getTelegramLoginConfig();
});

export const requestPasswordResetSmsFn = createServerFn({ method: "POST" })
  .validator(smsRequestSchema)
  .handler(async ({ data }) => {
    try {
      const result = await requestPasswordResetByPhone(data.phone, {
        ...getRequestMeta(),
        honeypot: data.honeypot,
      });
      logChannel("auth.password.forgot_sms", data.phone, result);
      return result;
    } catch (error) {
      rethrowAuth(error, "auth.password.forgot_sms", maskPhone(data.phone));
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
      return finishLogin(session, true, "auth.password.reset_sms");
    } catch (error) {
      rethrowAuth(error, "auth.password.reset_sms", maskPhone(data.phone));
    }
  });

export const signupFn = createServerFn({ method: "POST" })
  .validator(signupSchema)
  .handler(async ({ data }) => {
    try {
      const result = await signupWithEmail(
        { email: data.email, password: data.password },
        { ...getRequestMeta(), honeypot: data.honeypot },
      );
      if ("restore" in result) {
        void writeLog({
          level: "info",
          domain: "auth",
          action: "auth.signup",
          outcome: "skipped",
          message: "Аккаунт удалён. Предложено восстановление.",
          subject: data.email,
        });
        return { ok: true as const, restore: true as const };
      }
      return finishLogin(
        result.session,
        true,
        result.created ? "auth.signup" : "auth.login",
        result.created ? "Аккаунт создан по почте." : "Вход выполнен.",
      );
    } catch (error) {
      rethrowAuth(error, "auth.signup", data.email, null, data.honeypot?.trim() ? "denied" : undefined);
    }
  });

export const requestSmsSignupFn = createServerFn({ method: "POST" })
  .validator(smsRequestSchema)
  .handler(async ({ data }) => {
    try {
      const result = await requestSmsSignup(data.phone, { ...getRequestMeta(), honeypot: data.honeypot });
      logChannel("auth.signup.sms", data.phone, result);
      return result;
    } catch (error) {
      rethrowAuth(error, "auth.signup.sms", maskPhone(data.phone));
    }
  });

export const confirmSmsSignupFn = createServerFn({ method: "POST" })
  .validator(smsConfirmSchema)
  .handler(async ({ data }) => {
    try {
      const result = await confirmSmsSignup(data.phone, data.code, {
        ...getRequestMeta(),
        honeypot: data.honeypot,
      });
      return finishLogin(
        result.session,
        true,
        "auth.signup.sms",
        result.created ? "Аккаунт создан по телефону." : "Вход по телефону выполнен.",
      );
    } catch (error) {
      rethrowAuth(error, "auth.signup.sms", maskPhone(data.phone));
    }
  });

export const signupWithTelegramFn = createServerFn({ method: "POST" })
  .validator(telegramWidgetSchema)
  .handler(async ({ data }) => {
    try {
      const result = await signupWithTelegramWidget(data, {
        ...getRequestMeta(),
        honeypot: data.honeypot,
      });
      return finishLogin(
        result.session,
        true,
        "auth.signup.telegram",
        result.created ? "Аккаунт создан через Telegram." : "Вход через Telegram выполнен.",
      );
    } catch (error) {
      rethrowAuth(error, "auth.signup.telegram");
    }
  });

export const signupWithTelegramWebAppFn = createServerFn({ method: "POST" })
  .validator(telegramWebAppSchema)
  .handler(async ({ data }) => {
    try {
      const result = await signupWithTelegramWebApp(data.initData, {
        ...getRequestMeta(),
        honeypot: data.honeypot,
      });
      return finishLogin(
        result.session,
        true,
        "auth.signup.telegram.webapp",
        result.created ? "Аккаунт создан через Telegram." : "Вход через Telegram выполнен.",
      );
    } catch (error) {
      rethrowAuth(error, "auth.signup.telegram.webapp");
    }
  });

export const completeSignupCredentialsFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(signupCredentialsSchema)
  .handler(async ({ data, context }) => {
    try {
      await saveSignupCredentials(context.user.id, data.email, data.password);
      void writeLog({
        level: "info",
        domain: "auth",
        action: "auth.signup.credentials",
        outcome: "success",
        message: "Почта и пароль сохранены.",
        subject: data.email,
        actorUserId: context.user.id,
      });
      return { ok: true as const };
    } catch (error) {
      rethrowAuth(error, "auth.signup.credentials", data.email, context.user.id);
    }
  });

export const logoutFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }) => {
    const token = readSessionToken();
    if (token) {
      await revokeSessionByToken(token);
    }
    clearSessionCookie();
    void writeLog({
      level: "info",
      domain: "auth",
      action: "auth.logout",
      outcome: "success",
      message: "Выход из аккаунта.",
      subject: context.user.email,
      actorUserId: context.user.id,
    });
    return { ok: true as const };
  });

export const forgotPasswordFn = createServerFn({ method: "POST" })
  .validator(forgotPasswordSchema)
  .handler(async ({ data }) => {
    try {
      if (data.honeypot?.trim()) {
        void writeLog({
          level: "warn",
          domain: "auth",
          action: "auth.password.forgot",
          outcome: "denied",
          message: "Сброс пароля отклонён.",
          subject: data.email,
          context: { reason: "honeypot" },
        });
        return { ok: true as const };
      }
      consumeForgotEmailLimit(getRequestMeta().clientKey);
      await requestPasswordReset(data.email);
      void writeLog({
        level: "info",
        domain: "auth",
        action: "auth.password.forgot",
        outcome: "success",
        message: "Запрошен сброс пароля.",
        subject: data.email,
      });
      return { ok: true as const };
    } catch (error) {
      rethrowAuth(error, "auth.password.forgot", data.email);
    }
  });

export const resetPasswordFn = createServerFn({ method: "POST" })
  .validator(resetPasswordSchema)
  .handler(async ({ data }) => {
    try {
      await resetPassword(data.token, data.password);
      void writeLog({
        level: "info",
        domain: "auth",
        action: "auth.password.reset",
        outcome: "success",
        message: "Пароль обновлён.",
      });
      return {
        ok: true as const,
        message: "Пароль обновлён. Теперь можно войти с новым паролем.",
      };
    } catch (error) {
      rethrowAuth(error, "auth.password.reset");
    }
  });

export const setPasswordFn = createServerFn({ method: "POST" })
  .validator(resetPasswordSchema)
  .handler(async ({ data }) => {
    try {
      const meta = getRequestMeta();
      const session = await setPasswordFromEmailLink(data.token, data.password, meta);
      return finishLogin(session, true, "auth.password.set");
    } catch (error) {
      rethrowAuth(error, "auth.password.set");
    }
  });

export const verifyEmailFn = createServerFn({ method: "POST" })
  .validator(verifyEmailSchema)
  .handler(async ({ data }) => {
    try {
      await verifyEmailToken(data.token);
      void writeLog({
        level: "info",
        domain: "auth",
        action: "auth.email.verify",
        outcome: "success",
        message: "Почта подтверждена.",
      });
      return {
        ok: true as const,
        message: "E-mail подтверждён. Теперь можно войти.",
      };
    } catch (error) {
      rethrowAuth(error, "auth.email.verify");
    }
  });

export const confirmEmailChangeFn = createServerFn({ method: "POST" })
  .validator(verifyEmailSchema)
  .handler(async () => {
    rethrowAuth(new AuthError("Ссылка недействительна или устарела.", "INVALID_TOKEN"), "account.email.confirm");
  });

export const requestAccountEmailCodeFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(accountEmailSchema)
  .handler(async ({ data, context }) => {
    try {
      const result = await requestAccountEmailCode(context.user.id, data.email);
      void writeLog({
        level: "info",
        domain: "account",
        action: "account.email.request",
        outcome: "success",
        message: "Запрошен код смены почты.",
        subject: data.email,
        actorUserId: context.user.id,
      });
      return result;
    } catch (error) {
      rethrowAuth(error, "account.email.request", data.email, context.user.id);
    }
  });

export const confirmAccountEmailCodeFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(accountEmailCodeSchema)
  .handler(async ({ data, context }) => {
    try {
      const result = await confirmAccountEmailCode(context.user.id, data.email, data.code);
      void writeLog({
        level: "info",
        domain: "account",
        action: "account.email.confirm",
        outcome: "success",
        message: "Почта аккаунта изменена.",
        subject: data.email,
        actorUserId: context.user.id,
      });
      return result;
    } catch (error) {
      rethrowAuth(error, "account.email.confirm", data.email, context.user.id);
    }
  });

export const requestTrainerContactEmailCodeFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(accountEmailSchema)
  .handler(async ({ data, context }) => {
    try {
      const result = await requestTrainerContactEmailCode(context.user.id, data.email);
      void writeLog({
        level: "info",
        domain: "account",
        action: "trainer.email.request",
        outcome: "success",
        message: "Запрошен код подтверждения почты.",
        subject: data.email,
        actorUserId: context.user.id,
      });
      return result;
    } catch (error) {
      rethrowAuth(error, "trainer.email.request", data.email, context.user.id);
    }
  });

export const confirmTrainerContactEmailCodeFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(accountEmailCodeSchema)
  .handler(async ({ data, context }) => {
    try {
      const result = await confirmTrainerContactEmailCode(context.user.id, data.email, data.code);
      void writeLog({
        level: "info",
        domain: "account",
        action: "trainer.email.confirm",
        outcome: "success",
        message: "Почта подтверждена.",
        subject: data.email,
        actorUserId: context.user.id,
      });
      return result;
    } catch (error) {
      rethrowAuth(error, "trainer.email.confirm", data.email, context.user.id);
    }
  });

function accountLogSubject(email: string): string | null {
  return isPendingSignupEmail(email) ? null : email;
}

export const confirmTrainerTelegramFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(telegramWidgetSchema)
  .handler(async ({ data, context }) => {
    try {
      const result = await confirmTrainerTelegram(context.user.id, data);
      const subject = accountLogSubject(context.user.email);
      if (result.linkedAccount) {
        void writeLog({
          level: "info",
          domain: "auth",
          action: "auth.telegram.link",
          outcome: "success",
          message: "Telegram привязан к аккаунту при подтверждении карточки.",
          actorUserId: context.user.id,
          subject,
        });
      }
      void writeLog({
        level: "info",
        domain: "account",
        action: "trainer.telegram.confirm",
        outcome: "success",
        message: result.phoneStored
          ? "Telegram подтверждён, номер из Telegram записан."
          : "Telegram для связи подтверждён.",
        actorUserId: context.user.id,
        subject,
      });
      return result;
    } catch (error) {
      rethrowAuth(error, "trainer.telegram.confirm", accountLogSubject(context.user.email), context.user.id);
    }
  });

export const confirmTrainerTelegramWebAppFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(trainerTelegramWebAppSchema)
  .handler(async ({ data, context }) => {
    try {
      const result = await confirmTrainerTelegramWebApp(context.user.id, data.initData, data.contact);
      const subject = accountLogSubject(context.user.email);
      if (result.linkedAccount) {
        void writeLog({
          level: "info",
          domain: "auth",
          action: "auth.telegram.link",
          outcome: "success",
          message: "Telegram привязан к аккаунту при подтверждении карточки.",
          actorUserId: context.user.id,
          subject,
        });
      }
      void writeLog({
        level: "info",
        domain: "account",
        action: "trainer.telegram.confirm",
        outcome: "success",
        message: result.phoneStored
          ? "Telegram подтверждён, номер из Telegram записан."
          : "Telegram для связи подтверждён.",
        actorUserId: context.user.id,
        subject,
      });
      return result;
    } catch (error) {
      rethrowAuth(error, "trainer.telegram.confirm", accountLogSubject(context.user.email), context.user.id);
    }
  });

export const confirmTrainerPhoneFromTelegramFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(trainerTelegramPhoneSchema)
  .handler(async ({ data, context }) => {
    try {
      const result = await confirmTrainerPhoneFromTelegram(
        context.user.id,
        { initData: data.initData, widget: data.widget },
        data.contact,
      );
      void writeLog({
        level: "info",
        domain: "account",
        action: "account.phone.confirm",
        outcome: "success",
        message: result.message,
        actorUserId: context.user.id,
        subject: accountLogSubject(context.user.email),
      });
      return result;
    } catch (error) {
      rethrowAuth(error, "account.phone.confirm", accountLogSubject(context.user.email), context.user.id);
    }
  });

export const linkAccountTelegramFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(telegramWidgetSchema)
  .handler(async ({ data, context }) => {
    try {
      const result = await linkAccountTelegram(context.user.id, data);
      void writeLog({
        level: "info",
        domain: "auth",
        action: "auth.telegram.link",
        outcome: "success",
        message: result.already ? "Telegram уже был привязан к аккаунту." : "Telegram привязан к аккаунту.",
        actorUserId: context.user.id,
        subject: accountLogSubject(context.user.email),
        target: result.telegramUsername || null,
      });
      return result;
    } catch (error) {
      rethrowAuth(error, "auth.telegram.link", accountLogSubject(context.user.email), context.user.id);
    }
  });

export const linkAccountTelegramWebAppFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(telegramWebAppSchema)
  .handler(async ({ data, context }) => {
    try {
      const result = await linkAccountTelegramWebApp(context.user.id, data.initData);
      void writeLog({
        level: "info",
        domain: "auth",
        action: "auth.telegram.link",
        outcome: "success",
        message: result.already ? "Telegram уже был привязан к аккаунту." : "Telegram привязан к аккаунту из Mini App.",
        actorUserId: context.user.id,
        subject: accountLogSubject(context.user.email),
        target: result.telegramUsername || null,
      });
      return result;
    } catch (error) {
      rethrowAuth(error, "auth.telegram.link", accountLogSubject(context.user.email), context.user.id);
    }
  });

export const unlinkAccountTelegramFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }) => {
    try {
      const result = await unlinkAccountTelegram(context.user.id);
      void writeLog({
        level: "info",
        domain: "auth",
        action: "auth.telegram.unlink",
        outcome: "success",
        message: "Telegram отвязан от аккаунта.",
        actorUserId: context.user.id,
        subject: accountLogSubject(context.user.email),
      });
      return result;
    } catch (error) {
      rethrowAuth(error, "auth.telegram.unlink", accountLogSubject(context.user.email), context.user.id);
    }
  });

export const requestAccountPhoneCodeFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(accountPhoneSchema)
  .handler(async ({ data, context }) => {
    try {
      const result = await requestAccountPhoneCode(context.user.id, data.phone);
      void writeLog({
        level: "info",
        domain: "account",
        action: "account.phone.request",
        outcome: "success",
        message: "Запрошен код телефона.",
        subject: maskPhone(data.phone),
        actorUserId: context.user.id,
      });
      return result;
    } catch (error) {
      rethrowAuth(error, "account.phone.request", maskPhone(data.phone), context.user.id);
    }
  });

export const confirmAccountPhoneCodeFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(accountPhoneCodeSchema)
  .handler(async ({ data, context }) => {
    try {
      const result = await confirmAccountPhoneCode(context.user.id, data.phone, data.code);
      void writeLog({
        level: "info",
        domain: "account",
        action: "account.phone.confirm",
        outcome: "success",
        message: "Телефон аккаунта подтверждён.",
        subject: maskPhone(data.phone),
        actorUserId: context.user.id,
      });
      return result;
    } catch (error) {
      rethrowAuth(error, "account.phone.confirm", maskPhone(data.phone), context.user.id);
    }
  });

export const changePasswordFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(changePasswordSchema)
  .handler(async ({ data, context }) => {
    try {
      const result = await changeAccountPassword(
        context.user.id,
        data.currentPassword,
        data.newPassword,
        readSessionToken(),
      );
      void writeLog({
        level: "info",
        domain: "account",
        action: "account.password.change",
        outcome: "success",
        message: "Пароль аккаунта изменён.",
        subject: context.user.email,
        actorUserId: context.user.id,
      });
      return result;
    } catch (error) {
      rethrowAuth(error, "account.password.change", context.user.email, context.user.id);
    }
  });

export const setAccountAvatarFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(accountAvatarSchema)
  .handler(async ({ data, context }) => {
    try {
      const result = await setAccountAvatar(context.user.id, data.image);
      void writeLog({
        level: "info",
        domain: "account",
        action: "account.avatar",
        outcome: "success",
        message: "Аватар обновлён.",
        subject: context.user.email,
        actorUserId: context.user.id,
      });
      return result;
    } catch (error) {
      rethrowAuth(error, "account.avatar", context.user.email, context.user.id);
    }
  });

export const updateProfileFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(profileNameSchema)
  .handler(async ({ data, context }) => {
    try {
      await updateAccountName(context.user.id, data.firstName, data.lastName);
      void writeLog({
        level: "info",
        domain: "account",
        action: "account.name",
        outcome: "success",
        message: "Имя аккаунта обновлено.",
        subject: context.user.email,
        actorUserId: context.user.id,
      });
      return { ok: true as const };
    } catch (error) {
      rethrowAuth(error, "account.name", context.user.email, context.user.id);
    }
  });

export const updateMailPreferenceFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(mailPreferenceSchema)
  .handler(async ({ data, context }) => {
    try {
      await updateMailPreference(context.user.id, data.kind, data.enabled);
      void writeLog({
        level: "info",
        domain: "account",
        action: "account.mail",
        outcome: "success",
        message: "Настройка писем сохранена.",
        subject: context.user.email,
        actorUserId: context.user.id,
        context: { kind: data.kind, enabled: data.enabled },
      });
      return { ok: true as const };
    } catch (error) {
      rethrowAuth(error, "account.mail", context.user.email, context.user.id);
    }
  });

export const restoreAccountFn = createServerFn({ method: "POST" })
  .validator(loginSchema)
  .handler(async ({ data }) => {
    try {
      if (data.honeypot?.trim()) {
        throw new AuthError("Неверный логин или пароль.", "INVALID_CREDENTIALS");
      }
      const meta = getRequestMeta();
      consumePasswordLoginLimit(data.email, meta.clientKey);
      const session = await restoreOwnAccount(data.email, data.password, meta);
      return finishLogin(session, data.remember, "account.restore", "Пользователь восстановил аккаунт.");
    } catch (error) {
      rethrowAuth(error, "account.restore", data.email, null);
    }
  });

export const deleteAccountFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(deleteAccountSchema)
  .handler(async ({ data, context }) => {
    try {
      await deleteOwnAccount({ id: context.user.id, roles: context.user.roles }, data.password);
      clearSessionCookie();
      return { ok: true as const };
    } catch (error) {
      rethrowAuth(error, "account.delete", context.user.email, context.user.id);
    }
  });

export const getCurrentUserFn = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }) => {
    return toPublicUser(context.user);
  });
