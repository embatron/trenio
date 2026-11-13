import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { authErrorMessage } from "@/lib/auth/errors";
import { ensureConversationFn } from "@/lib/messages/functions";
import { markTrainerDialogOpened, PHONE_SHEET, trainerDialogAlreadyOpened } from "@/lib/messages/phone-history";

/**
 * `?trainer=` means that card's dialog. Hold the list's "open the first row"
 * until the server has returned that session and the URL shows its id.
 * On a phone the dialog is pushed, so the system back button returns to this
 * list instead of the page that opened it. A wide screen still replaces.
 */
export function useOpenTrainerThread(
  trainer: string | undefined,
  to: "/me/messages/$conversationId" | "/account/messages/$conversationId",
  conversationId: string | null,
) {
  const navigate = useNavigate();
  const ensure = useServerFn(ensureConversationFn);
  const [error, setError] = useState<string | null>(null);
  const [hold, setHold] = useState(() => Boolean(trainer));
  const slugRef = useRef<string | null>(null);
  const targetRef = useRef<string | null>(null);

  useEffect(() => {
    if (!trainer) {
      setHold(false);
      return;
    }
    const phone = window.matchMedia(PHONE_SHEET).matches;
    if (phone && trainerDialogAlreadyOpened(window.history.state, trainer)) {
      slugRef.current = trainer;
      setHold(false);
      void navigate({
        to: to === "/account/messages/$conversationId" ? "/account/messages" : "/me/messages",
        search: {},
        replace: true,
      });
      return;
    }
    if (slugRef.current === trainer) return;
    slugRef.current = trainer;
    targetRef.current = null;
    setHold(true);
    setError(null);
    void ensure({ data: { trainerProfileSlug: trainer } })
      .then((result) => {
        if (slugRef.current !== trainer) return;
        targetRef.current = result.conversationId;
        const phone = window.matchMedia(PHONE_SHEET).matches;
        if (phone) {
          const marked = markTrainerDialogOpened(window.history.state, trainer);
          if (marked) History.prototype.replaceState.call(window.history, marked, "");
        }
        void navigate({
          to,
          params: { conversationId: result.conversationId },
          search: {},
          replace: !phone,
        });
      })
      .catch((err) => {
        if (slugRef.current !== trainer) return;
        setError(authErrorMessage(err));
        setHold(false);
      });
  }, [trainer, ensure, navigate, to]);

  useEffect(() => {
    if (hold && targetRef.current && conversationId === targetRef.current) setHold(false);
  }, [hold, conversationId]);

  return { hold, error };
}
