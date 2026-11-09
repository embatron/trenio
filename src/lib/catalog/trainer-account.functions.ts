import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { requireAuthMiddleware } from "@/auth/middleware";
import { clientIpFromHeaders } from "@/auth/request-meta";
import { signupWithEmail } from "@/auth/signup-channels";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { AuthError } from "@/lib/auth/errors";
import { profileNameSchema } from "@/lib/auth/schemas";
import { hasAnyRole, isStaff } from "@/lib/auth/roles";
import { openManualTrainerAccount } from "@/lib/catalog/trainer-account";
import { writeLog } from "@/lib/log/logger";

const trainerSignupSchema = profileNameSchema.extend({
  email: z.string().trim().email("Введите корректный e-mail"),
  password: z.string().min(1, "Введите пароль").max(128),
  passwordConfirm: z.string().min(1).max(128),
  privacy: z.boolean().refine((value) => value, { message: "Примите политику конфиденциальности." }),
  honeypot: z.string().max(200).optional().default(""),
});

function requestMeta() {
  const request = getRequest();
  const ipAddress = clientIpFromHeaders(request.headers.get("x-real-ip"));
  return { ipAddress, userAgent: request.headers.get("user-agent"), clientKey: ipAddress };
}

export const signupTrainerAccountFn = createServerFn({ method: "POST" })
  .validator(trainerSignupSchema)
  .handler(async ({ data }) => {
    if (data.password !== data.passwordConfirm) {
      throw new AuthError("Пароли не совпадают.", "VALIDATION");
    }
    try {
      const tripped = Boolean(data.honeypot.trim());
      const result = await signupWithEmail(
        { email: data.email, password: data.password },
        { ...requestMeta(), honeypot: data.honeypot },
        { firstName: data.firstName, lastName: data.lastName, intent: "trainer_create" },
      );
      void writeLog({
        level: tripped ? "warn" : "info",
        domain: "auth",
        action: "auth.signup",
        outcome: tripped ? "denied" : "success",
        message: tripped ? "Заявка кабинета отклонена." : "Запрошено письмо кабинета тренера.",
        subject: tripped ? null : data.email,
        route: "/join/account",
        context: tripped ? { reason: "honeypot" } : { intent: "trainer_create" },
      });
      return { ok: true as const, message: result.message };
    } catch (error) {
      void writeLog({
        level: "error",
        domain: "auth",
        action: "auth.signup",
        outcome: data.honeypot.trim() ? "denied" : "failure",
        message: "Кабинет тренера не создан.",
        subject: data.honeypot.trim() ? null : data.email,
        route: "/join/account",
        context: { intent: "trainer_create" },
        error,
      });
      if (error instanceof AuthError) throw error;
      throw new AuthError("Не удалось отправить письмо. Попробуйте ещё раз.", "VALIDATION");
    }
  });

const becomeSchema = profileNameSchema;

export const becomeTrainerFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(becomeSchema)
  .handler(async ({ data, context }) => {
    if (isStaff(context.user.roles) || hasAnyRole(context.user.roles, ["club"])) {
      throw new AuthError("Этот аккаунт не становится карточкой тренера.", "FORBIDDEN");
    }
    if (hasAnyRole(context.user.roles, ["trainer"])) {
      return { ok: true as const, redirectTo: "/me/profile" };
    }
    const db = getDb();
    await db.update(users).set({
      firstName: data.firstName,
      lastName: data.lastName,
      lastSignupIntent: context.user.lastSignupIntent === "trainer_claim" ? "trainer_claim" : "trainer_create",
      updatedAt: new Date(),
    }).where(eq(users.id, context.user.id));
    await openManualTrainerAccount({
      id: context.user.id,
      email: context.user.email,
      firstName: data.firstName,
      lastName: data.lastName,
    });
    void writeLog({
      level: "info",
      domain: "account",
      action: "account.claim",
      outcome: "success",
      message: "Аккаунт стал кабинетом тренера без Instagram.",
      subject: context.user.email,
      actorUserId: context.user.id,
      route: "/join/account",
    });
    return { ok: true as const, redirectTo: "/me/profile" };
  });
