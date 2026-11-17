import { useRouteContext } from "@tanstack/react-router";
import { useState, type MouseEvent } from "react";

import { InstagramIcon, TelegramIcon } from "@/components/brand-icons";
import { DirectMark } from "@/components/messages/direct-mark";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatBelarusPhone } from "@/lib/auth/phone";
import { recordTrainerContactClick } from "@/lib/catalog/trainer-contact-client";
import { directMessageHref } from "@/lib/auth/roles";
import { getPublishedTrainer } from "@/lib/catalog/published-trainers";

const PHONE_PATH =
  "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.5 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.4a2 2 0 0 1 2.1-.5c.9.2 1.8.4 2.7.5A2 2 0 0 1 22 16.9z";
type ExternalContactKind = "phone" | "instagram" | "telegram";
type PendingContact = {
  kind: ExternalContactKind;
  href: string;
  label: string;
  newTab: boolean;
};

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
  phone,
  heading,
}: {
  slug: string;
  instagram?: string;
  telegram?: string;
  phone?: string;
  heading?: string;
}) {
  const { user, messaging } = useRouteContext({ from: "__root__" });
  const [pendingContact, setPendingContact] = useState<PendingContact | null>(null);
  const trainer = getPublishedTrainer(slug);
  const instagramUrl = instagramHref(instagram ?? trainer?.instagram ?? "");
  const telegramUrl = telegramHref(telegram ?? "");
  const phoneLink = phoneHref(phone ?? "");
  const showDirect = !messaging.ownedSlugs.includes(slug);
  if (!phoneLink && !instagramUrl && !telegramUrl && !showDirect) return null;

  const thread = `/account/messages?trainer=${encodeURIComponent(slug)}`;
  const directHref = user
    ? directMessageHref(user.roles, slug)
    : `/auth/login?redirect=${encodeURIComponent(thread)}`;
  const askBeforeLeaving = (event: MouseEvent<HTMLAnchorElement>, contact: PendingContact) => {
    event.preventDefault();
    setPendingContact(contact);
  };

  const icons = (
    <div className="trainer-contacts" onClick={stopCardNavigation}>
      {phoneLink ? (
        <a
          className="trainer-contacts__link trainer-contacts__link--line trainer-contacts__link--phone"
          href={phoneLink.href}
          aria-label={`Позвонить ${phoneLink.label}`}
          aria-haspopup="dialog"
          title={phoneLink.label}
          onClick={(event) =>
            askBeforeLeaving(event, {
              kind: "phone",
              href: phoneLink.href,
              label: "телефон",
              newTab: false,
            })
          }
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={PHONE_PATH} />
          </svg>
          {heading ? <span className="trainer-contacts__phone">{phoneLink.label}</span> : null}
        </a>
      ) : null}
      {instagramUrl ? (
        <a
          className="trainer-contacts__link"
          href={instagramUrl}
          target="_blank"
          rel="ugc noopener noreferrer"
          aria-label="Instagram"
          aria-haspopup="dialog"
          title="Instagram"
          onClick={(event) =>
            askBeforeLeaving(event, {
              kind: "instagram",
              href: instagramUrl,
              label: "Instagram",
              newTab: true,
            })
          }
        >
          <InstagramIcon />
        </a>
      ) : null}
      {telegramUrl ? (
        <a
          className="trainer-contacts__link"
          href={telegramUrl}
          target="_blank"
          rel="ugc noopener noreferrer"
          aria-label="Telegram"
          aria-haspopup="dialog"
          title="Telegram"
          onClick={(event) =>
            askBeforeLeaving(event, {
              kind: "telegram",
              href: telegramUrl,
              label: "Telegram",
              newTab: true,
            })
          }
        >
          <TelegramIcon />
        </a>
      ) : null}
      {showDirect ? (
        <a
          className="trainer-contacts__link trainer-contacts__link--line trainer-contacts__link--send"
          href={directHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Написать"
          title="Написать"
          onClick={() => recordTrainerContactClick(slug, "message")}
        >
          <DirectMark disc />
        </a>
      ) : null}
    </div>
  );

  const dialog = (
    <AlertDialog
      open={Boolean(pendingContact)}
      onOpenChange={(open) => {
        if (!open) setPendingContact(null);
      }}
    >
      <AlertDialogContent className="w-[calc(100%-32px)] max-w-[440px] rounded-[var(--card-radius)] border-[var(--line)] bg-white p-5">
        <AlertDialogHeader className="space-y-3 text-left">
          <AlertDialogTitle className="text-[20px] font-[var(--fw-heading)] text-[var(--dark)]">
            Связаться с тренером
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[15px] leading-[1.55] text-[var(--text)]">
            Сейчас откроется{" "}
            {pendingContact?.kind === "phone"
              ? "приложение для звонка тренеру"
              : `${pendingContact?.label ?? "контакт"} тренера`}
            . Когда будете связываться, пожалуйста, скажите, что нашли тренера на Trenio.by. Для вас
            это всего пара слов, а нам это помогает делать сервис полезнее и знакомить вас с
            хорошими специалистами.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:space-x-0">
          <AlertDialogCancel className="mt-0 min-h-11 rounded-full border-[var(--line)] bg-white px-4 text-[var(--dark)]">
            Остаться здесь
          </AlertDialogCancel>
          {pendingContact ? (
            <AlertDialogAction asChild>
              <a
                href={pendingContact.href}
                target={pendingContact.newTab ? "_blank" : undefined}
                rel={pendingContact.newTab ? "ugc noopener noreferrer" : undefined}
                className="min-h-11 rounded-full bg-[var(--primary)] px-5 text-white hover:bg-[var(--primary-dark)]"
                onClick={() => recordTrainerContactClick(slug, pendingContact.kind)}
              >
                {pendingContact.kind === "phone" ? "Позвонить" : `Открыть ${pendingContact.label}`}
              </a>
            </AlertDialogAction>
          ) : null}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (!heading)
    return (
      <>
        {icons}
        {dialog}
      </>
    );

  return (
    <>
      <section className="profile-block profile-reach">
        <h2 className="profile-heading">{heading}</h2>
        {icons}
      </section>
      {dialog}
    </>
  );
}
