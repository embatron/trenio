import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { authErrorMessage } from "@/lib/auth/errors";
import { ensureConversationFn } from "@/lib/messages/functions";

/**
 * `?trainer=` means that card's dialog. Hold the list's "open the first row"
 * until the server has returned that session and the URL shows its id.
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
    if (slugRef.current === trainer) return;
    slugRef.current = trainer;
    targetRef.current = null;
    setHold(true);
    setError(null);
    void ensure({ data: { trainerProfileSlug: trainer } })
      .then((result) => {
        if (slugRef.current !== trainer) return;
        targetRef.current = result.conversationId;
        void navigate({
          to,
          params: { conversationId: result.conversationId },
          search: {},
          replace: true,
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
