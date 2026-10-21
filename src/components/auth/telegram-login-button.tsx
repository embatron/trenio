import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { getTelegramLoginConfigFn } from "@/lib/auth/functions";
import type { TelegramWidgetUser } from "@/lib/auth/telegram-widget";

const WIDGET_SCRIPT = "https://telegram.org/js/telegram-widget.js?22";
const PUBLIC_BOT_USERNAME =
  (import.meta.env.VITE_TELEGRAM_LOGIN_BOT_USERNAME as string | undefined)?.trim() ?? "";

type TelegramLoginButtonProps = {
  onAuth: (user: TelegramWidgetUser) => void;
};

export function TelegramLoginButton({ onAuth }: TelegramLoginButtonProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onAuthRef = useRef(onAuth);
  const getConfig = useServerFn(getTelegramLoginConfigFn);
  const [username, setUsername] = useState<string | null>(PUBLIC_BOT_USERNAME || null);
  const [checked, setChecked] = useState(Boolean(PUBLIC_BOT_USERNAME));

  onAuthRef.current = onAuth;

  useEffect(() => {
    window.__trenioTelegramAuth = (user) => {
      onAuthRef.current(user);
    };
    return () => {
      delete window.__trenioTelegramAuth;
    };
  }, []);

  useEffect(() => {
    if (username) return;
    let cancelled = false;
    void getConfig().then((config) => {
      if (cancelled) return;
      setChecked(true);
      if (config.enabled && config.username) setUsername(config.username);
    });
    return () => {
      cancelled = true;
    };
  }, [getConfig, username]);

  useEffect(() => {
    if (!username || !hostRef.current) return;
    const host = hostRef.current;
    host.replaceChildren();
    const script = document.createElement("script");
    script.src = WIDGET_SCRIPT;
    script.async = true;
    script.setAttribute("data-telegram-login", username);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "8");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-lang", "ru");
    script.setAttribute("data-onauth", "__trenioTelegramAuth(user)");
    host.appendChild(script);
  }, [username]);

  if (!username) {
    if (!checked) return <p className="auth-muted">Проверяем вход через Telegram…</p>;
    return (
      <p className="auth-muted">
        Вход через Telegram сейчас недоступен. Войдите по e-mail или телефону.
      </p>
    );
  }

  return (
    <div className="auth-telegram">
      <div ref={hostRef} className="h-10 w-[238px] overflow-hidden" />
      <p className="auth-muted">Кнопка открывает бота @{username}.</p>
    </div>
  );
}
