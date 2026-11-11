import { sanitizeReviewHtml } from "@/lib/catalog/review-html";

type Kind = "bold" | "italic" | "underline" | "strike" | "code" | "pre" | "spoiler";

const MARKS: { open: string; kind: Kind }[] = [
  { open: "```", kind: "pre" },
  { open: "||", kind: "spoiler" },
  { open: "~~", kind: "strike" },
  { open: "**", kind: "bold" },
  { open: "__", kind: "underline" },
  { open: "`", kind: "code" },
  { open: "~", kind: "strike" },
  { open: "_", kind: "italic" },
  { open: "*", kind: "bold" },
];

function escapeText(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function wrap(kind: Kind, inner: string) {
  if (kind === "bold") return `<strong>${inner}</strong>`;
  if (kind === "italic") return `<em>${inner}</em>`;
  if (kind === "underline") return `<u>${inner}</u>`;
  if (kind === "strike") return `<s>${inner}</s>`;
  if (kind === "code") return `<code>${inner}</code>`;
  if (kind === "pre") return `<pre>${inner}</pre>`;
  return `<span class="tg-spoiler">${inner}</span>`;
}

function findClose(input: string, from: number, open: string) {
  for (let index = from; index < input.length; index += 1) {
    if (input[index] === "\\") {
      index += 1;
      continue;
    }
    if (!input.startsWith(open, index)) continue;
    if (open.length === 1 && input.startsWith(open + open, index)) {
      index += open.length;
      continue;
    }
    return index;
  }
  return null;
}

type Token = {
  kind: Kind | "link";
  start: number;
  contentStart: number;
  contentEnd: number;
  end: number;
  href?: string;
  label?: string;
};

function tokenAt(input: string, index: number): Token | null {
  const link = linkAt(input, index);
  if (link) {
    return { kind: "link", start: index, contentStart: index, contentEnd: index, end: link.end, href: link.href, label: link.label };
  }
  for (const mark of MARKS) {
    if (!input.startsWith(mark.open, index)) continue;
    const contentStart = index + mark.open.length;
    const close = findClose(input, contentStart, mark.open);
    if (close == null || close === contentStart) continue;
    const inner = input.slice(contentStart, close);
    if (mark.kind === "code" && inner.includes("\n")) continue;
    return { kind: mark.kind, start: index, contentStart, contentEnd: close, end: close + mark.open.length };
  }
  return null;
}

/** A marker the caret just closed. Links stay for the send step. */
export function markerEndingAt(input: string, offset: number) {
  let found: Token | null = null;
  for (let index = 0; index < offset; index += 1) {
    if (input[index] === "\\") {
      index += 1;
      continue;
    }
    const token = tokenAt(input, index);
    if (!token || token.kind === "link" || token.end !== offset) continue;
    const pair = token.start > 0 ? input.slice(token.start - 1, token.start + 1) : "";
    if (pair === "**" || pair === "__" || pair === "~~" || pair === "||" || pair === "``") continue;
    if (!found || token.start < found.start) found = token;
  }
  return found;
}

function linkAt(input: string, index: number) {
  if (input[index] !== "[") return null;
  const match = /^\[([^\]\n]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/.exec(input.slice(index));
  if (!match) return null;
  return { label: match[1], href: match[2], end: index + match[0].length };
}

/** Turn Telegram inline markers into HTML. The product does not explain the markers. */
export function renderMessageMarkers(input: string): string {
  let out = "";
  for (let index = 0; index < input.length; index += 1) {
    if (input[index] === "\\" && index + 1 < input.length) {
      out += escapeText(input[index + 1]);
      index += 1;
      continue;
    }
    const token = tokenAt(input, index);
    if (token?.kind === "link" && token.label && token.href) {
      out += `<a href="${escapeAttr(token.href)}" rel="nofollow noopener">${renderMessageMarkers(token.label)}</a>`;
      index = token.end - 1;
      continue;
    }
    if (token && token.kind !== "link") {
      const inner = input.slice(token.contentStart, token.contentEnd);
      const body = token.kind === "code" || token.kind === "pre" ? escapeText(inner) : renderMessageMarkers(inner);
      out += wrap(token.kind, body);
      index = token.end - 1;
      continue;
    }
    out += escapeText(input[index]);
  }
  return out;
}

function decodeBasic(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function markupFragments(html: string) {
  const parts = html.split(/(<[^>]*>)/g);
  let code = 0;
  return parts.map((part) => {
    if (part.startsWith("<")) {
      if (/^<\s*(code|pre)\b/i.test(part)) code += 1;
      if (/^<\s*\/\s*(code|pre)\b/i.test(part)) code = Math.max(0, code - 1);
      return part;
    }
    if (!part || code > 0) return part;
    return renderMessageMarkers(decodeBasic(part));
  }).join("");
}

/** Markers in a plain field or in editor HTML, then the same allow-list as the bubble. */
export function messageMarkup(value: string) {
  const marked = /[<>]/.test(value) ? markupFragments(value) : renderMessageMarkers(value);
  return sanitizeReviewHtml(marked);
}
