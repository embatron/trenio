import { SITE_EMAIL } from "@/lib/seo/site";
import { mailAppUrl } from "@/lib/mail/send.server";

export type LetterPerson = {
  name: string;
  /** Site path or absolute URL. Empty uses the first letter of the name. */
  avatarUrl?: string;
  caption?: string;
};

export type Letter = {
  title: string;
  lead?: string;
  person?: LetterPerson;
  /** Plain text of what that person wrote. */
  quote?: string;
  /** Confirmation code. Its own line, larger and bold. */
  code?: string;
  lines?: string[];
  action?: { href: string; label: string };
  note?: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function absoluteAvatar(url: string | undefined) {
  const value = url?.trim() ?? "";
  if (!value) return "";
  if (value.startsWith("https://") || value.startsWith("http://")) return value;
  if (value.startsWith("/")) return `${mailAppUrl()}${value.split("?")[0]}`;
  return "";
}

function initial(name: string) {
  const letter = [...name.trim()][0] ?? "T";
  return letter.toLocaleUpperCase("ru");
}

function avatarCell(person: LetterPerson) {
  const src = absoluteAvatar(person.avatarUrl);
  const mark = src
    ? `<img src="${escapeHtml(src)}" width="64" height="64" alt="" style="display:block;width:64px;height:64px;border-radius:50%;object-fit:cover;">`
    : `<div style="width:64px;height:64px;border-radius:50%;background:#f04b50;color:#ffffff;font:700 26px/64px Arial,sans-serif;text-align:center;">${escapeHtml(initial(person.name))}</div>`;
  return `<td width="64" valign="top" style="width:64px;padding:0 15px 0 0;">${mark}</td>`;
}

/** Settings page for the gray unsubscribe link. Login returns here. */
export function mailSettingsUrl() {
  return `${mailAppUrl()}/mail`;
}

/** One letter shape for every Trenio mail: logo, a person in a circle, then what they wrote. */
export function renderLetter(letter: Letter) {
  const lines = letter.lines ?? [];
  const code = letter.code?.trim() ?? "";
  const settingsUrl = mailSettingsUrl();
  const home = mailAppUrl();
  const text = [
    letter.title,
    letter.lead ?? "",
    letter.person ? letter.person.name : "",
    letter.person?.caption ?? "",
    letter.quote ?? "",
    code ? `Код\n\n${code}` : "",
    ...lines,
    letter.action ? `${letter.action.label}: ${letter.action.href}` : "",
    letter.note ?? "",
    `trenio.by · ${SITE_EMAIL}`,
    `Отписаться: ${settingsUrl}`,
  ].filter((line) => line !== "").join("\n\n");

  const person = letter.person
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 9px;"><tr>${avatarCell(letter.person)}<td valign="middle"><div style="font:700 18px Arial,sans-serif;color:#111827;">${escapeHtml(letter.person.name)}</div>${letter.person.caption ? `<div style="margin-top:4px;font:14px Arial,sans-serif;color:#6b7280;">${escapeHtml(letter.person.caption)}</div>` : ""}</td></tr></table>`
    : "";
  const quote = letter.quote
    ? `<div style="margin:9px 0 22px;padding:15px 18px;border-radius:16px;background:#fff5f5;font:16px/1.5 Arial,sans-serif;color:#1f2937;white-space:pre-wrap;">${escapeHtml(letter.quote)}</div>`
    : "";
  const codeBlock = code
    ? `<p style="margin:13px 0 4px;font:16px/1.5 Arial,sans-serif;color:#1f2937;">Код</p><p style="margin:0 0 13px;font:700 22px/1.2 Arial,sans-serif;letter-spacing:0.12em;color:#111827;">${escapeHtml(code)}</p>`
    : "";
  const bodyLines = lines.map((line) => `<p style="margin:0 0 13px;font:16px/1.5 Arial,sans-serif;color:#1f2937;">${escapeHtml(line)}</p>`).join("");
  const action = letter.action
    ? `<p style="margin:22px 0;"><a href="${escapeHtml(letter.action.href)}" style="display:inline-block;padding:13px 24px;border-radius:999px;background:#f04b50;color:#ffffff;font:700 15px Arial,sans-serif;text-decoration:none;">${escapeHtml(letter.action.label)}</a></p>`
    : "";
  const note = letter.note ? `<p style="margin:0 0 9px;font:14px/1.45 Arial,sans-serif;color:#6b7280;">${escapeHtml(letter.note)}</p>` : "";
  const lead = letter.lead ? `<p style="margin:0 0 9px;font:16px/1.5 Arial,sans-serif;color:#1f2937;">${escapeHtml(letter.lead)}</p>` : "";
  const logo = `${home}/logo.webp`;

  const html = `<!DOCTYPE html><html lang="ru"><body style="margin:0;padding:26px;background:#f9fafb;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#ffffff;border-radius:22px;padding:31px;">
<tr><td><a href="${escapeHtml(home)}" style="text-decoration:none;"><img src="${escapeHtml(logo)}" width="157" height="40" alt="trenio.by" style="display:block;width:157px;height:40px;border:0;"></a></td></tr>
<tr><td style="padding-top:20px;font:700 22px Arial,sans-serif;color:#111827;">${escapeHtml(letter.title)}</td></tr>
<tr><td style="padding-top:13px;">${lead}${person}${quote}${codeBlock}${bodyLines}${action}${note}</td></tr>
<tr><td style="padding-top:20px;font:13px Arial,sans-serif;color:#6b7280;">trenio.by · ${escapeHtml(SITE_EMAIL)}</td></tr>
<tr><td style="padding-top:13px;font:13px/1.45 Arial,sans-serif;"><a href="${escapeHtml(settingsUrl)}" style="color:#9ca3af;text-decoration:underline;">Отписаться</a></td></tr>
</table></td></tr></table></body></html>`;

  return { text, html };
}
