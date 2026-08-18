import { z } from "zod";

import type { UserRole } from "@/lib/auth/types";
import { PUBLIC_SIGNUP_ROLES } from "@/lib/auth/roles";
import { OTP_CODE_LENGTH } from "@/lib/auth/phone";

const honeypotField = z.string().optional().default("");

export const loginSchema = z.object({
  email: z.string().email("Введите корректный e-mail"),
  password: z.string().min(1, "Введите пароль"),
  remember: z.boolean().optional().default(true),
  company_url: honeypotField,
});

export const signupSchema = z.object({
  email: z.string().email("Введите корректный e-mail"),
  firstName: z.string().trim().min(1, "Укажите имя").max(100),
  lastName: z.string().trim().max(100).optional(),
  signupRole: z.enum(PUBLIC_SIGNUP_ROLES),
  company_url: honeypotField,
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Введите корректный e-mail"),
  company_url: honeypotField,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Минимум 8 символов"),
});

export const setPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Минимум 8 символов"),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export const confirmEmailSchema = z.object({
  token: z.string().min(1),
});

export const requestSmsSchema = z.object({
  phone: z.string().min(1, "Введите номер телефона"),
  company_url: honeypotField,
});

export const confirmSmsSchema = z.object({
  phone: z.string().min(1),
  code: z.string().min(OTP_CODE_LENGTH).max(OTP_CODE_LENGTH),
  remember: z.boolean().optional().default(true),
  company_url: honeypotField,
});

export const requestEmailChangeSchema = z.object({
  email: z.string().email("Введите корректный e-mail"),
});

export const updateNameSchema = z.object({
  firstName: z.string().trim().min(1, "Укажите имя").max(100),
  lastName: z.string().trim().max(100).optional(),
});

export const requestPhoneVerifySchema = z.object({
  phone: z.string().min(1, "Введите номер телефона"),
  company_url: honeypotField,
});

export const confirmPhoneVerifySchema = z.object({
  phone: z.string().min(1),
  code: z.string().min(OTP_CODE_LENGTH).max(OTP_CODE_LENGTH),
  company_url: honeypotField,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;

export type PublicUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  phoneVerified: boolean;
  emailVerified: boolean;
  roles: UserRole[];
  status: string;
  lastSignupIntent: string | null;
};
