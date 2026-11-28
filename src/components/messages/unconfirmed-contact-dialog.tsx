import { useRouteContext } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState, type FormEvent } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { isPendingSignupEmail } from "@/lib/auth/pending-email";
import { sendUnconfirmedContactFn } from "@/lib/catalog/unconfirmed-contact";

export function UnconfirmedContactDialog({
  slug,
  open,
  onOpenChange,
}: {
  slug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useRouteContext({ from: "__root__" });
  const send = useServerFn(sendUnconfirmedContactFn);
  const knownMail = Boolean(user && user.emailVerified && !isPendingSignupEmail(user.email));
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [company, setCompany] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  function close(next: boolean) {
    if (!next) {
      setError("");
      setSent(false);
      setPending(false);
    }
    onOpenChange(next);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await send({
        data: {
          slug,
          message,
          reply: knownMail ? undefined : reply,
          company,
        },
      });
      setSent(true);
      setMessage("");
      setReply("");
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : "Не удалось отправить сообщение. Попробуйте ещё раз.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={close}>
      <AlertDialogContent
        className="w-[calc(100%-32px)] max-w-[440px] rounded-[var(--card-radius)] border-[var(--line)] bg-white p-5"
        onOpenAutoFocus={(event) => {
          if (sent) return;
          event.preventDefault();
          messageRef.current?.focus();
        }}
      >
        <AlertDialogHeader className="space-y-3 text-left">
          <AlertDialogTitle className="text-[20px] font-[var(--fw-heading)] text-[var(--dark)]">
            Аккаунт ещё не подтверждён
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[15px] leading-[1.55] text-[var(--text)]">
            Тренер пока не подтвердил аккаунт, поэтому связаться напрямую не получится. Оставьте сообщение, и мы попробуем его разыскать.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {sent ? (
          <p className="m-0 text-[15px] leading-[1.5] text-[var(--dark)]">Сообщение отправлено. Мы попробуем разыскать тренера.</p>
        ) : (
          <form className="grid gap-3" onSubmit={(event) => void submit(event)}>
            <label className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
              Компания
              <input tabIndex={-1} autoComplete="off" value={company} onChange={(event) => setCompany(event.target.value)} />
            </label>
            <label className="grid gap-1.5 text-[13px] text-[var(--muted)]">
              Сообщение
              <textarea
                ref={messageRef}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                required
                rows={4}
                maxLength={4000}
                placeholder="Напишите, как вас найти и что передать"
                className="min-h-28 w-full resize-y rounded-2xl border border-[var(--line)] bg-white px-3 py-3 text-base text-[var(--text)] outline-none focus-visible:border-[var(--primary)]"
              />
            </label>
            {knownMail ? null : (
              <label className="grid gap-1.5 text-[13px] text-[var(--muted)]">
                Как вам ответить
                <input
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  required={!user}
                  maxLength={120}
                  autoComplete="email"
                  placeholder="Почта или телефон"
                  className="h-11 w-full rounded-full border border-[var(--line)] bg-white px-4 text-base text-[var(--text)] outline-none focus-visible:border-[var(--primary)]"
                />
              </label>
            )}
            {error ? <p className="m-0 text-[13px] text-[var(--primary-dark)]">{error}</p> : null}
            <AlertDialogFooter className="gap-2 sm:space-x-0">
              <AlertDialogCancel type="button" className="mt-0 min-h-11 rounded-full border-[var(--line)] bg-white px-4 text-[var(--dark)]" disabled={pending}>
                Закрыть
              </AlertDialogCancel>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--primary)] px-5 text-[14px] font-[var(--fw-title)] text-white hover:bg-[var(--primary-dark)] disabled:opacity-60"
              >
                {pending ? "Отправка…" : "Отправить"}
              </button>
            </AlertDialogFooter>
          </form>
        )}
        {sent ? (
          <AlertDialogFooter className="gap-2 sm:space-x-0">
            <AlertDialogCancel className="mt-0 min-h-11 rounded-full bg-[var(--primary)] px-5 text-white hover:bg-[var(--primary-dark)]">
              Хорошо
            </AlertDialogCancel>
          </AlertDialogFooter>
        ) : null}
      </AlertDialogContent>
    </AlertDialog>
  );
}
