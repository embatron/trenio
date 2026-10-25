import { z } from "zod";

import type { UserRole } from "@/lib/auth/types";
import { PUBLIC_SIGNUP_ROLES } from "@/lib/auth/roles";

const honeypotSchema = z.string().max(200).optional();

export const loginSchema = z.object({
  email: z.string().trim().min(3, "Введите почту или ник").max(320),
  password: z.string().min(1, "Введите пароль"),
  remember: z.boolean().optional().default(true),
  honeypot: honeypotSchema,
});

export const smsRequestSchema = z.object({
  phone: z.string().trim().min(7).max(32),
  honeypot: honeypotSchema,
});

export const smsConfirmSchema = smsRequestSchema.extend({
  code: z.string().trim().min(4).max(8),
});

export const smsResetSchema = smsConfirmSchema.extend({
  password: z.string().min(8).max(128),
});

export const telegramWidgetSchema = z.object({
  id: z.coerce.number().int().positive(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().optional(),
  auth_date: z.coerce.number().int(),
  hash: z.string().min(8),
  honeypot: honeypotSchema,
});

export const telegramWebAppSchema = z.object({
  initData: z.string().min(8).max(4096),
  honeypot: honeypotSchema,
});

export const signupSchema = z.object({
  email: z.string().email("Введите корректный e-mail"),
  password: z.string().min(8, "Минимум 8 символов"),
  firstName: z.string().trim().min(1, "Укажите имя").max(100),
  lastName: z.string().trim().min(1, "Укажите фамилию").max(100),
  phone: z.string().trim().max(32).optional(),
  signupRole: z.enum(PUBLIC_SIGNUP_ROLES),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Введите корректный e-mail"),
  honeypot: honeypotSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Минимум 8 символов"),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export const profileNameSchema = z.object({
  firstName: z.string().trim().min(1, "Укажите имя").max(100),
  lastName: z.string().trim().min(1, "Укажите фамилию").max(100),
});

export const accountAvatarSchema = z.object({
  image: z.string().min(32).max(2_200_000),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Введите текущий пароль"),
  newPassword: z.string().min(8, "Пароль должен содержать минимум 8 символов"),
});

export const accountEmailSchema = z.object({
  email: z.string().trim().email("Введите корректный e-mail"),
});

export const accountEmailCodeSchema = accountEmailSchema.extend({
  code: z.string().trim().min(4).max(8),
});

export const accountPhoneSchema = z.object({
  phone: z.string().trim().min(7).max(32),
});

export const accountPhoneCodeSchema = accountPhoneSchema.extend({
  code: z.string().trim().min(4).max(8),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;

export type PublicUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  avatarPath: string;
  /** Instagram handle of a trainer or club. Empty for everyone else. */
  nick: string;
  emailVerified: boolean;
  roles: UserRole[];
  status: string;
  lastSignupIntent: string | null;
};
