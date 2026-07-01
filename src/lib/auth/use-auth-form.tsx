import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";

import { authErrorMessage, isAuthError } from "@/lib/auth/errors";

export function useAuthSubmit() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const navigate = useNavigate();

  async function run<T>(action: () => Promise<T>, onSuccess?: (result: T) => void | Promise<void>) {
    setError(null);
    setPending(true);
    try {
      const result = await action();
      await onSuccess?.(result);
      return result;
    } catch (err) {
      if (isAuthError(err)) {
        setError(err.message);
      } else {
        setError(authErrorMessage(err));
      }
      return null;
    } finally {
      setPending(false);
    }
  }

  function redirectTo(path: string) {
    void navigate({ to: path });
  }

  return { error, pending, run, redirectTo, setError };
}

export function AuthAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="auth-alert" role="alert">
      {message}
    </div>
  );
}

export function useAuthServerFn<T extends (...args: never[]) => Promise<unknown>>(fn: T) {
  return useServerFn(fn);
}
