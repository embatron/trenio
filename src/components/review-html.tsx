import { useState } from "react";

import {
  REVIEW_PREVIEW_CHARS,
  compactReviewHtml,
  reviewExcerpt,
  reviewPlainText,
  reviewTextLength,
  reviewVisibleText,
  sanitizeReviewHtml,
} from "@/lib/catalog/review-html";

export function ReviewHtml({ html, className }: { html: string; className?: string }) {
  const safe = sanitizeReviewHtml(html);
  if (!/<[a-z]/i.test(safe)) {
    return <p className={className}>{reviewPlainText(safe)}</p>;
  }
  return <div className={className ? `${className} review-html` : "review-html"} dangerouslySetInnerHTML={{ __html: safe }} />;
}

/** Trainer-page review: tighter text, and the rest opens under the excerpt. */
export function ReviewExcerpt({ html, className }: { html: string; className?: string }) {
  const compact = compactReviewHtml(html);
  const long = reviewTextLength(reviewVisibleText(compact)) > REVIEW_PREVIEW_CHARS;
  const [open, setOpen] = useState(false);

  return (
    <div className="review-excerpt">
      {long && !open ? (
        <p className={className}>{reviewExcerpt(compact)}</p>
      ) : (
        <ReviewHtml className={className} html={compact} />
      )}
      {long ? (
        <button
          type="button"
          className="review-excerpt__more"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Свернуть" : "Читать полностью"}
        </button>
      ) : null}
    </div>
  );
}
