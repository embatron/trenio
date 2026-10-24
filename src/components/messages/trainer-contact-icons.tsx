import { useRouteContext } from "@tanstack/react-router";

import { InstagramIcon, TelegramIcon } from "@/components/brand-icons";
import { formatBelarusPhone } from "@/lib/auth/phone";
import { getPublishedTrainer } from "@/lib/catalog/published-trainers";

const PHONE_PATH = "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.5 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.4a2 2 0 0 1 2.1-.5c.9.2 1.8.4 2.7.5A2 2 0 0 1 22 16.9z";
const MAIL_PATH = "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 6l8 6 8-6";
const DIRECT_PATH = "M4 12L20 4l-6 16-2.4-6.2L4 12zM11.6 13.8L20 4";

function httpsHref(raw: string): string | null {
  const value = raw.trim();
  if (!/^https:\/\//i.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function telegramHref(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const direct = httpsHref(value);
  if (direct && /^https:\/\/(t\.me|telegram\.me)\//i.test(direct)) return direct;
  const handle = value.replace(/^@/, "");
  if (/^[A-Za-z0-9_]{4,32}$/.test(handle)) return `https://t.me/${handle}`;
  return null;
}

function instagramHref(raw: string): string | null {
  const direct = httpsHref(raw);
  if (!direct || !/^https:\/\/(www\.)?instagram\.com\//i.test(direct)) return null;
  return direct;
}

function emailHref(raw: string): string | null {
  const value = raw.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return null;
  return `mailto:${value}`;
}

function phoneHref(raw: string): { href: string; label: string } | null {
  const label = formatBelarusPhone(raw);
  if (!label) return null;
  return { href: `tel:+${label.replace(/\D/g, "")}`, label };
}

function stopCardNavigation(event: { stopPropagation: () => void }) {
  event.stopPropagation();
}

export function TrainerContactIcons({
  slug,
  instagram,
  telegram,
  email,
  phone,
  heading,
}: {
  slug: string;
  instagram?: string;
  telegram?: string;
  email?: string;
  phone?: string;
  heading?: string;
}) {
  const { user, messaging } = useRouteContext({ from: "__root__" });
  const trainer = getPublishedTrainer(slug);
  const instagramUrl = instagramHref(instagram ?? trainer?.instagram ?? "");
  const telegramUrl = telegramHref(telegram ?? trainer?.telegram ?? "");
  const mailUrl = emailHref(email ?? trainer?.email ?? "");
  const phoneLink = phoneHref(phone ?? trainer?.phone ?? "");
  const showDirect = !messaging.ownedSlugs.includes(slug);
  if (!phoneLink && !instagramUrl && !telegramUrl && !mailUrl && !showDirect) return null;

  const thread = `/account/messages?trainer=${encodeURIComponent(slug)}`;
  const directHref = user ? thread : `/auth/login?redirect=${encodeURIComponent(thread)}`;

  const icons = (
    <div className="trainer-contacts" onClick={stopCardNavigation}>
      {phoneLink ? (
        <a className="trainer-contacts__link trainer-contacts__link--line trainer-contacts__link--phone" href={phoneLink.href} aria-label={`Позвонить ${phoneLink.label}`} title={phoneLink.label}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={PHONE_PATH} /></svg>
          {heading ? <span className="trainer-contacts__phone">{phoneLink.label}</span> : null}
        </a>
      ) : null}
      {instagramUrl ? (
        <a className="trainer-contacts__link" href={instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram" title="Instagram">
          <InstagramIcon />
        </a>
      ) : null}
      {telegramUrl ? (
        <a className="trainer-contacts__link" href={telegramUrl} target="_blank" rel="noopener noreferrer" aria-label="Telegram" title="Telegram">
          <TelegramIcon />
        </a>
      ) : null}
      {mailUrl ? (
        <a className="trainer-contacts__link trainer-contacts__link--line" href={mailUrl} target="_blank" rel="noopener noreferrer" aria-label="Почта" title="Почта">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={MAIL_PATH} /></svg>
        </a>
      ) : null}
      {showDirect ? (
        <a className="trainer-contacts__link trainer-contacts__link--line" href={directHref} target="_blank" rel="noopener noreferrer" aria-label="Написать" title="Написать">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={DIRECT_PATH} /></svg>
        </a>
      ) : null}
    </div>
  );

  if (!heading) return icons;

  return (
    <section className="profile-block profile-reach">
      <h2 className="profile-heading">{heading}</h2>
      {icons}
    </section>
  );
}
