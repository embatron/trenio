import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";

import { CabinetModal } from "@/components/cabinet";
import { publishUnverifiedTrainerFn } from "@/lib/admin/trainers";
import { authErrorMessage } from "@/lib/auth/errors";
import { useAuthServerFn } from "@/lib/auth/use-auth-form";

/** Switch an unconfirmed card between unpublished and published. The seal stays gray. */
export function UnverifiedPublish({ slug, published, enabled }: { slug: string; published: boolean; enabled: boolean }) {
  const router = useRouter();
  const save = useAuthServerFn(publishUnverifiedTrainerFn);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const next = !published;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending]);

  if (!enabled) return null;

  function confirm() {
    if (pending) return;
    setPending(true);
    setError("");
    void save({ data: { slug, published: next } })
      .then(() => {
        setOpen(false);
        return router.invalidate();
      })
      .catch((err: unknown) => setError(authErrorMessage(err) || "Не удалось сменить публикацию."))
      .finally(() => setPending(false));
  }

  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={published}
        aria-label={published ? "Опубликована без подтверждения" : "Опубликовать без подтверждения"}
        title={published ? "Опубликована без подтверждения" : "Опубликовать без подтверждения"}
        className={`mail-switch cabinet-publish-switch${published ? " is-on" : ""}`}
        disabled={pending}
        onClick={() => setOpen(true)}
      >
        <span className="mail-switch__thumb" />
      </button>
      {open ? (
        <CabinetModal onClick={() => { if (!pending) setOpen(false); }}>
          <div
            className="cabinet-modal__card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="unverified-publish-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="unverified-publish-title">
              {next ? "Опубликовать без подтверждения?" : "Снять с публикации?"}
            </h2>
            <p>
              {next
                ? "Страница станет опубликованной. Аккаунт останется неподтверждённым, галочка серой."
                : "Страница снова станет неопубликованной. Подтверждение аккаунта не изменится."}
            </p>
            {error ? <p className="cabinet-form__error">{error}</p> : null}
            <div className="cabinet-modal__actions">
              <button type="button" onClick={confirm} disabled={pending}>
                {pending ? "Сохранение…" : next ? "Опубликовать" : "Снять"}
              </button>
              <button type="button" className="cabinet-form__ghost" onClick={() => setOpen(false)} disabled={pending}>Отмена</button>
            </div>
          </div>
        </CabinetModal>
      ) : null}
    </>
  );
}
