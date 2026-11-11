import { Link, useRouteContext, useRouterState } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useAccountLikes } from "@/components/account-likes-store";
import { accountLikeLabel, canPlaceAccountLike } from "@/lib/catalog/account-like-rules";
import { authErrorMessage, isAuthorizationRequired } from "@/lib/auth/errors";

const THUMB_PATHS = [
  "M7 10v12",
  "M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z",
] as const;

const GUEST_GATE = {
  title: "Войдите, чтобы поставить лайкос",
  message: "Лайкос доступен зарегистрированным пользователям и тренерам.",
  login: true,
};

const ROLE_GATE = {
  title: "Лайкос недоступен",
  message: "Лайкос доступен зарегистрированным пользователям и тренерам.",
  login: false,
};

type Gate = {
  title: string;
  message: string;
  login: boolean;
};

export function AccountLikeButton({ slug, className }: { slug: string; className: string }) {
  const { user } = useRouteContext({ from: "__root__" });
  const { marks, toggle } = useAccountLikes();
  const href = useRouterState({ select: (state) => state.location.href });
  const mark = marks.find((item) => item.slug === slug);
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const liked = optimistic ?? (Boolean(user) && Boolean(mark));
  const [gate, setGate] = useState<Gate | null>(null);
  const pending = useRef(false);
  const allowed = Boolean(user && canPlaceAccountLike(user.roles));
  const redirect = href.startsWith("/") ? href.split("#")[0].slice(0, 200) : "/";
  const label = !user
    ? "Войдите, чтобы поставить лайкос"
    : !allowed
      ? "Лайкос доступен пользователям и тренерам"
      : liked
        ? mark && mark.count >= 0
          ? `Убрать лайкос, ${accountLikeLabel(mark.count)}`
          : "Убрать лайкос"
        : "Лайкос";

  return (
    <>
      <button
        type="button"
        className={`${className}${liked ? " is-liked" : ""}`}
        aria-pressed={liked}
        aria-label={label}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!user) {
            setGate(GUEST_GATE);
            return;
          }
          if (!allowed) {
            setGate(ROLE_GATE);
            return;
          }
          if (pending.current) return;
          pending.current = true;
          setOptimistic(!liked);
          void toggle(slug)
            .catch((error: unknown) => {
              if (isAuthorizationRequired(error)) {
                setGate(GUEST_GATE);
                return;
              }
              setGate({
                title: "Не удалось сохранить лайкос",
                message: authErrorMessage(error),
                login: false,
              });
            })
            .finally(() => {
              pending.current = false;
              setOptimistic(null);
            });
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          {THUMB_PATHS.map((path) => (
            <path key={path} d={path} />
          ))}
        </svg>
        {liked && mark ? (
          <span className="account-like__tip" aria-hidden="true">{mark.count}</span>
        ) : null}
      </button>
      {gate ? <LikeGate gate={gate} redirect={redirect} onClose={() => setGate(null)} /> : null}
    </>
  );
}

function LikeGate({ gate, redirect, onClose }: { gate: Gate; redirect: string; onClose: () => void }) {
  const titleId = useId();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="like-gate-backdrop" onClick={onClose}>
      <div
        className="like-gate"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId}>{gate.title}</h2>
        <p>{gate.message}</p>
        <div className="like-gate__actions">
          {gate.login ? (
            <Link className="like-gate__go" to="/auth/login" search={{ redirect }}>Войти</Link>
          ) : (
            <button type="button" className="like-gate__go" onClick={onClose}>Закрыть</button>
          )}
          {gate.login ? (
            <button type="button" className="like-gate__close" onClick={onClose}>Закрыть</button>
          ) : null}
        </div>
      </div>
      <style>{LIKE_GATE_CSS}</style>
    </div>,
    document.body,
  );
}

const LIKE_GATE_CSS = `
.like-gate-backdrop { position: fixed; inset: 0; z-index: 420; display: grid; place-items: center; overflow: auto; padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); background: rgba(var(--dark-rgb), 0.45); }
.like-gate { box-sizing: border-box; width: min(440px, 100%); display: grid; gap: 12px; padding: 20px; border-radius: var(--card-radius); background: var(--white); color: var(--text); }
.like-gate h2 { margin: 0; font-size: 18px; color: var(--dark); }
.like-gate p { margin: 0; color: var(--text); line-height: 1.45; }
.like-gate__actions { display: flex; flex-wrap: wrap; gap: 8px; }
.like-gate__go { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 16px; border: 0; border-radius: 999px; background: var(--primary); color: #fff; font: inherit; font-size: 14px; font-weight: var(--fw-title); text-decoration: none; cursor: pointer; }
.like-gate__close { min-height: 44px; padding: 0 16px; border: 1px solid var(--line); border-radius: 999px; background: var(--white); color: var(--dark); font: inherit; font-size: 14px; font-weight: var(--fw-ui); cursor: pointer; }
`;
