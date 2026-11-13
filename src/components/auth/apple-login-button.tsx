import { useEffect, useState } from "react";

import { AppleIcon } from "@/components/brand-icons";
import { nativeIosShell, signInWithApple } from "@/lib/native/shell";

/** Shown only inside the iOS shell. The website keeps Google and Yandex. */
export function AppleLoginButton({
  returnPath,
  browse = false,
  disabled = false,
  onBlocked,
  onError,
}: {
  returnPath?: string;
  browse?: boolean;
  disabled?: boolean;
  onBlocked?: () => void;
  onError?: (message: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    setVisible(nativeIosShell());
  }, []);
  if (!visible) return null;
  return (
    <button
      type="button"
      className="auth-google"
      disabled={disabled || pending}
      onClick={() => {
        if (disabled) {
          onBlocked?.();
          return;
        }
        setPending(true);
        void signInWithApple({ returnPath, browse })
          .then((result) => {
            if ("error" in result) {
              setPending(false);
              onError?.(result.error);
              return;
            }
            window.location.assign(result.redirectTo);
          })
          .catch(() => {
            setPending(false);
            onError?.("Не удалось войти через Apple. Попробуйте ещё раз.");
          });
      }}
    >
      <AppleIcon />
      Войти с Apple
    </button>
  );
}
