import { createMiddleware } from "@tanstack/react-start";

import { AuthError } from "@/lib/auth/errors";
import { findValidSession } from "@/auth/service";
import type { SessionUser } from "@/auth/service";
import { readSessionToken } from "@/auth/session";

export const optionalAuthMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const token = readSessionToken();
    const user = token ? await findValidSession(token) : null;
    return next({ context: { user } });
  },
);

export const requireAuthMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const token = readSessionToken();
    const user = token ? await findValidSession(token) : null;
    if (!user) {
      throw new AuthError("Требуется авторизация.", "UNAUTHORIZED");
    }
    return next({ context: { user } });
  },
);

export type AuthContext = {
  user: SessionUser | null;
};

export type RequiredAuthContext = {
  user: SessionUser;
};
