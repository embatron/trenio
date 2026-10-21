import { useEffect, useState } from "react";

import { getTelegramWebAppInitData } from "@/lib/telegram-webapp";

function TelegramPlaneIcon() {
  return (
    <svg viewBox="0 0 24 24" width={21} height={21} aria-hidden>
      <path
        fill="currentColor"
        d="M9.04 15.3 8.9 18.7c.36 0 .52-.16.7-.34l1.68-1.6 3.48 2.56c.64.36 1.1.16 1.26-.58l2.28-10.74c.2-.86-.32-1.2-.9-1L3.7 10.16c-.84.32-.82.78-.14.98l4.1 1.28 9.52-6c.46-.28.88-.12.54.18"
      />
    </svg>
  );
}

export function TelegramWebAppAuthButton({
  onAuth,
}: {
  onAuth: (initData: string) => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [initData, setInitData] = useState("");

  useEffect(() => {
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      const next = getTelegramWebAppInitData();
      if (next || attempts >= 8) {
        setInitData(next);
        window.clearInterval(timer);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, []);

  if (!initData) return null;

  return (
    <button
      type="button"
      className="auth-submit"
      disabled={pending}
      onClick={() => {
        setPending(true);
        void onAuth(initData).finally(() => setPending(false));
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <TelegramPlaneIcon />
        {pending ? "Вход…" : "Войти через Telegram"}
      </span>
    </button>
  );
}
