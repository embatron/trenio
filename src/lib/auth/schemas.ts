import { z } from "zod";

import type { UserRole } from "@/lib/auth/types";
import { PUBLIC_SIGNUP_ROLES } from "@/lib/auth/roles";

export const loginSchema = z.object({
  email: z.string().email("Введите корректный e-mail"),
  password: z.string().min(1, "Введите пароль"),
  remember: z.boolean().optional().default(true),
});

export const signupSchema = z.object({
  email: z.string().email("Введите корректный e-mail"),
  password: z.string().min(8, "Минимум 8 символов"),
  firstName: z.string().trim().min(1, "Укажите имя").max(100),
  lastName: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(32).optional(),
  signupRole: z.enum(PUBLIC_SIGNUP_ROLES),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Введите корректный e-mail"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Минимум 8 символов"),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;

export type PublicUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  emailVerified: boolean;
  roles: UserRole[];
  status: string;
  lastSignupIntent: string | null;
};
