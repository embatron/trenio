import { reviewPlainText, sanitizeReviewHtml } from "@/lib/catalog/review-html";

export function ReviewHtml({ html, className }: { html: string; className?: string }) {
  const safe = sanitizeReviewHtml(html);
  if (!/<[a-z]/i.test(safe)) {
    return <p className={className}>{reviewPlainText(safe)}</p>;
  }
  return <div className={className ? `${className} review-html` : "review-html"} dangerouslySetInnerHTML={{ __html: safe }} />;
}
