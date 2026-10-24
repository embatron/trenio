import { useState } from "react";

import { MessageEditor } from "@/components/messages/message-editor";
import { reviewPlainText, reviewTextLength, sanitizeReviewHtml } from "@/lib/catalog/review-html";

export function MessageComposer({
  limit,
  disabled,
  hint,
  onSend,
}: {
  limit: number;
  disabled: boolean;
  hint?: string | null;
  onSend: (body: string) => Promise<void>;
}) {
  const [html, setHtml] = useState("");
  const [busy, setBusy] = useState(false);
  const max = limit > 0 ? limit : 4000;
  const length = reviewTextLength(html);
  const over = length > max;
  const empty = reviewPlainText(html).length === 0;

  async function submit() {
    const body = sanitizeReviewHtml(html);
    if (!reviewPlainText(body) || disabled || busy || over) return;
    setBusy(true);
    try {
      await onSend(body);
      setHtml("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="direct-composer"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {hint ? <p className="direct-composer__hint">{hint}</p> : null}
      <div className="direct-composer__box">
        <MessageEditor value={html} onChange={setHtml} disabled={disabled || busy} onSubmit={() => void submit()} />
        <div className="direct-composer__bar">
          <p className={`direct-composer__count${over ? " is-over" : ""}`}>{length}/{max}</p>
          <button type="submit" className="direct-composer__send" disabled={disabled || busy || over || empty}>
            {busy ? "…" : "Отправить"}
          </button>
        </div>
      </div>
    </form>
  );
}
