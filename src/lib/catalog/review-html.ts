const ALLOWED = new Set(["b", "strong", "i", "em", "ul", "ol", "li", "p", "br", "a"]);

function escapeAttr(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** Keep a small set of tags from the review editor. Everything else becomes text. */
export function sanitizeReviewHtml(raw: string): string {
  const withoutDanger = raw
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|iframe|object|embed|svg)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(script|style|iframe|object|embed|svg)[^>]*\/?>/gi, "");

  return withoutDanger.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (match, tagName: string, attrs: string) => {
    const tag = tagName.toLowerCase();
    if (tag === "div") return match.startsWith("</") ? "</p>" : "<p>";
    if (!ALLOWED.has(tag)) return "";
    if (match.startsWith("</")) return `</${tag}>`;
    if (tag === "br") return "<br>";
    if (tag === "a") {
      const href = /href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
      const value = (href?.[1] ?? href?.[2] ?? href?.[3] ?? "").trim();
      if (!/^https?:\/\//i.test(value) && !/^mailto:/i.test(value)) return "";
      return `<a href="${escapeAttr(value)}" rel="nofollow noopener">`;
    }
    return `<${tag}>`;
  });
}

export function editorHtml(parts: string[]) {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return parts.map((part) => {
    if (/<[a-z]/i.test(part)) return part;
    return `<p>${part.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`;
  }).join("");
}

export function reviewPlainText(html: string): string {
  return sanitizeReviewHtml(html)
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
}
