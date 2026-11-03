import { createMiddleware } from "@tanstack/react-start";

import { findValidSession } from "@/auth/service";
import type { SessionUser } from "@/auth/service";
import { readSessionToken } from "@/auth/session";
import { AuthError } from "@/lib/auth/errors";
import { isPendingSignupEmail } from "@/lib/auth/pending-email";
import { isStaff } from "@/lib/auth/roles";

function assertAccountReady(user: SessionUser) {
  if (isPendingSignupEmail(user.email)) {
    throw new AuthError("Сначала подтвердите почту и сохраните пароль.", "FORBIDDEN");
  }
  if (user.needsPassword && user.lastSignupIntent === "trainer_claim") {
    throw new AuthError("Сначала задайте пароль.", "FORBIDDEN");
  }
  if (isStaff(user.roles) && !user.totpEnabled) {
    throw new AuthError("Сначала подключите код подтверждения.", "FORBIDDEN");
  }
}

async function readUser() {
  const token = readSessionToken();
  return token ? await findValidSession(token) : null;
}

export const optionalAuthMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const user = await readUser();
    return next({ context: { user } });
  },
);

/** A signed-in person, including one who still has to finish mail, a door password, or staff TOTP. */
export const requireSessionMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const user = await readUser();
    if (!user) throw new AuthError("Требуется авторизация.", "UNAUTHORIZED");
    return next({ context: { user } });
  },
);

export const requireAuthMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const user = await readUser();
    if (!user) throw new AuthError("Требуется авторизация.", "UNAUTHORIZED");
    assertAccountReady(user);
    return next({ context: { user } });
  },
);

export type AuthContext = {
  user: SessionUser | null;
};

export type RequiredAuthContext = {
  user: SessionUser;
};
