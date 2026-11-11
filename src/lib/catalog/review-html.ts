const ALLOWED = new Set(["b", "strong", "i", "em", "u", "s", "code", "pre", "span", "ul", "ol", "li", "p", "br", "a"]);

/** Block tags from a paste become paragraphs. The editor only stores the allowed set. */
const BLOCK_AS_P = new Set([
  "div",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "section",
  "article",
  "header",
  "footer",
  "pre",
  "figure",
  "figcaption",
  "address",
  "center",
  "main",
  "aside",
]);

function escapeAttr(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function escapeText(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Keep a small set of tags from the review editor. Everything else becomes text. */
export function sanitizeReviewHtml(raw: string): string {
  const withoutDanger = raw
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!DOCTYPE[^>]*>/gi, "")
    .replace(/<\?[\s\S]*?\?>/g, "")
    .replace(/<(script|style|iframe|object|embed|svg|noscript)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(script|style|iframe|object|embed|svg|noscript)[^>]*\/?>/gi, "")
    .replace(/<\/?[a-z0-9]+:[^>]*>/gi, "");

  let openAnchors = 0;
  let spoilers = 0;
  return withoutDanger.replace(
    /<\/?([a-z0-9]+)([^>]*)>/gi,
    (match, tagName: string, attrs: string) => {
      const tag = tagName.toLowerCase();
      if (tag === "pre" || tag === "code") {
        if (match.startsWith("</")) return `</${tag}>`;
        return `<${tag}>`;
      }
      if (BLOCK_AS_P.has(tag)) return match.startsWith("</") ? "</p>" : "<p>";
      if (!ALLOWED.has(tag)) return "";
      if (tag === "a") {
        if (match.startsWith("</")) {
          if (openAnchors === 0) return "";
          openAnchors -= 1;
          return "</a>";
        }
        const href = /href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
        const value = (href?.[1] ?? href?.[2] ?? href?.[3] ?? "").trim();
        if (!/^https?:\/\//i.test(value) && !/^mailto:/i.test(value)) return "";
        openAnchors += 1;
        return `<a href="${escapeAttr(value)}" rel="nofollow noopener">`;
      }
      if (tag === "span") {
        if (match.startsWith("</")) {
          if (spoilers === 0) return "";
          spoilers -= 1;
          return "</span>";
        }
        if (/\bclass\s*=\s*["']tg-spoiler["']/.test(attrs)) {
          spoilers += 1;
          return `<span class="tg-spoiler">`;
        }
        return "";
      }
      if (match.startsWith("</")) return `</${tag}>`;
      if (tag === "br") return "<br>";
      return `<${tag}>`;
    },
  );
}

/**
 * Clipboard HTML for the trainer and review editors.
 * Keeps paragraphs, emphasis, and lists. Word markup, styles, and scripts are dropped.
 * Plain text is used when the HTML has no visible words.
 */
export function pastedReviewHtml(html: string, plain: string): string {
  const fromHtml = html.trim() ? sanitizeReviewHtml(html) : "";
  if (reviewPlainText(fromHtml)) return fromHtml;
  if (!plain) return fromHtml;
  return escapeText(plain).replace(/\n/g, "<br>");
}

export function editorHtml(parts: string[]) {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return parts
    .map((part) => {
      if (/<[a-z]/i.test(part)) return part;
      return `<p>${part.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`;
    })
    .join("");
}

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** Public review cards show this many characters, then the rest opens below. */
export const REVIEW_PREVIEW_CHARS = 200;

/** Drop blank paragraphs and repeated spaces. Paragraph breaks stay. */
export function compactReviewHtml(raw: string): string {
  return sanitizeReviewHtml(raw)
    .replace(/&nbsp;/gi, " ")
    .replace(/<p>\s*(?:<br\s*\/?>\s*)*<\/p>/gi, "")
    .replace(/(?:<br\s*\/?>\s*){2,}/gi, "<br>")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+(<\/(?:p|li)>)/gi, "$1")
    .replace(/(<(?:p|li)>)\s+/gi, "$1")
    .trim();
}

/** One line of visible review text, after blank lines and extra spaces are gone. */
export function reviewVisibleText(raw: string): string {
  return reviewPlainText(compactReviewHtml(raw)).replace(/\s+/g, " ").trim();
}

/** Cut on a word near the limit and mark the rest with an ellipsis. */
export function reviewExcerpt(raw: string, limit = REVIEW_PREVIEW_CHARS): string {
  const plain = reviewVisibleText(raw);
  const chars = [...graphemes.segment(plain)];
  if (chars.length <= limit) return plain;
  const head = chars
    .slice(0, limit)
    .map((part) => part.segment)
    .join("");
  const windowStart = Math.max(0, limit - 40);
  const space = head.slice(windowStart).lastIndexOf(" ");
  const cut = space > 0 ? windowStart + space : limit;
  return (
    chars
      .slice(0, cut)
      .map((part) => part.segment)
      .join("")
      .trimEnd() + "…"
  );
}

/** Visible characters, after markup is removed. One emoji is one character. */
export function reviewTextLength(html: string): number {
  return [...graphemes.segment(reviewPlainText(html))].length;
}

/** Format, control, and other characters that do not show a glyph. */
function hasVisibleMessageText(value: string) {
  return /[^\p{Cf}\p{Cc}\s\u00AD\u034F\u115F\u1160\u17B4\u17B5\u3164\uFFA0]/u.test(value);
}

export function reviewPlainText(html: string): string {
  const text = sanitizeReviewHtml(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|div)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return hasVisibleMessageText(text) ? text : "";
}
