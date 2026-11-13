import { sanitizeReviewHtml } from "@/lib/catalog/review-html";

/** One blank line. A third break in a row does not add another. */
export const MESSAGE_BREAK_RUN = 2;

/** Line breaks kept in one message. Further breaks are dropped. */
export const MESSAGE_BREAK_CAP = 200;

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** Collapse a pasted or typed run, then stop after the break cap. */
export function collapsePlainBreaks(text: string, cap = MESSAGE_BREAK_CAP): string {
  const collapsed = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n".repeat(MESSAGE_BREAK_RUN));
  let seen = 0;
  let out = "";
  for (const char of collapsed) {
    if (char === "\n") {
      seen += 1;
      if (seen > cap) continue;
    }
    out += char;
  }
  return out;
}

/** Keep the first `maxLength` graphemes after breaks are collapsed. */
export function clipPlainMessage(text: string, maxLength: number): string {
  const collapsed = collapsePlainBreaks(text);
  if (maxLength <= 0) return "";
  const parts = [...graphemes.segment(collapsed)];
  if (parts.length <= maxLength) return collapsed;
  return parts
    .slice(0, maxLength)
    .map((part) => part.segment)
    .join("");
}

export function plainToEditorHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

/** True when the editor HTML has a blank-line run or more breaks than the cap. */
export function messageBreaksNeedTighten(html: string): boolean {
  const brs = html.match(/<br\b/gi)?.length ?? 0;
  if (brs > MESSAGE_BREAK_CAP) return true;
  if (new RegExp(`(?:<br\\b[^>]*>\\s*){${MESSAGE_BREAK_RUN + 1},}`, "i").test(html)) return true;
  if (/(?:<p\b[^>]*>(?:\s|<br\b[^>]*>)*<\/p>\s*){3,}/i.test(html)) return true;
  return false;
}

function capNewlinesOutsidePre(html: string, cap: number): string {
  const parts = html.split(/(<\/?pre>)/i);
  let open = false;
  let seen = 0;
  return parts
    .map((part) => {
      if (/^<pre>$/i.test(part)) {
        open = true;
        return part;
      }
      if (/^<\/pre>$/i.test(part)) {
        open = false;
        return part;
      }
      if (open) return part;
      const collapsed = part.replace(/\n{3,}/g, "\n".repeat(MESSAGE_BREAK_RUN));
      return collapsed.replace(/\n/g, (newline) => {
        seen += 1;
        return seen <= cap ? newline : "";
      });
    })
    .join("");
}

/**
 * Stored message HTML. Runs of blank lines become one blank line.
 * A million breaks stay within the cap, including inside the editor.
 */
export function collapseMessageHtml(html: string, cap = MESSAGE_BREAK_CAP): string {
  const safe = sanitizeReviewHtml(html);
  const run = MESSAGE_BREAK_RUN;
  let out = safe.replace(new RegExp(`(?:<br>\\s*){${run + 1},}`, "gi"), "<br>".repeat(run));
  out = out.replace(/(?:<p>(?:\s|<br>)*<\/p>\s*){3,}/gi, "<p><br></p>");
  let brs = 0;
  out = out.replace(/<br>/gi, () => {
    brs += 1;
    return brs <= cap ? "<br>" : "";
  });
  return capNewlinesOutsidePre(out, cap);
}
