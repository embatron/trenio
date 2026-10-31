import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuthMiddleware } from "@/auth/middleware";
import { AuthError } from "@/lib/auth/errors";
import { assertStaff } from "@/lib/admin/access";
import { reviewTextLength } from "@/lib/catalog/review-html";
import { logCaught, writeLog } from "@/lib/log/logger";
import {
  renderTrainerWelcome,
  userWelcomePartCount,
} from "@/lib/site-texts/defaults";
import { loadSiteTexts, saveSiteTexts } from "@/lib/site-texts/store";

const textField = z.string().trim().min(1, "Текст не может быть пустым.").max(8000);

const saveSchema = z.object({
  trainerWelcome: textField,
  userWelcome: textField,
  instagramMessage: textField,
});

function assertUsable(input: z.infer<typeof saveSchema>) {
  if (reviewTextLength(renderTrainerWelcome("Владимир", input.trainerWelcome)) > 4000) {
    throw new AuthError("Приветствие тренеру длиннее 4000 символов.", "VALIDATION");
  }
  if (userWelcomePartCount(input.userWelcome) < 4) {
    throw new AuthError("В письме пользователю нужны четыре части, разделённые строкой ---.", "VALIDATION");
  }
  if (!input.instagramMessage.includes("{doorUrl}")) {
    throw new AuthError("В сообщении для Instagram оставьте метку {doorUrl} — это короткая ссылка.", "VALIDATION");
  }
}

export const getSiteTextsFn = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }) => {
    assertStaff(context.user.roles);
    const texts = await loadSiteTexts();
    return {
      trainerWelcome: texts.trainer_welcome,
      userWelcome: texts.user_welcome,
      instagramMessage: texts.instagram_message,
    };
  });

export const saveSiteTextsFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(saveSchema)
  .handler(async ({ data, context }) => {
    assertStaff(context.user.roles);
    assertUsable(data);
    try {
      await saveSiteTexts(context.user.id, {
        trainer_welcome: data.trainerWelcome,
        user_welcome: data.userWelcome,
        instagram_message: data.instagramMessage,
      });
    } catch (error) {
      logCaught("admin", "admin.site_text", error, { actorUserId: context.user.id });
      throw new AuthError("Не удалось сохранить тексты. Запустите установку таблицы.", "VALIDATION");
    }
    void writeLog({
      level: "info",
      domain: "admin",
      action: "admin.site_text",
      outcome: "success",
      message: "Тексты сайта сохранены.",
      actorUserId: context.user.id,
      context: {
        trainer: data.trainerWelcome.length,
        user: data.userWelcome.length,
        instagram: data.instagramMessage.length,
      },
    });
    return { ok: true as const };
  });
