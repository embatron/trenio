import type { ReactNode } from "react";

import { InstagramIcon, TelegramIcon } from "@/components/brand-icons";
import type { OwnTrainerProfile } from "@/lib/catalog/trainer-own";

const PHONE_PATH = "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.5 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.4a2 2 0 0 1 2.1-.5c.9.2 1.8.4 2.7.5A2 2 0 0 1 22 16.9z";
const MAIL_PATH = "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 6l8 6 8-6";

function LineIcon({ path }: { path: string }) {
  return (
    <svg className="cabinet-line" viewBox="0 0 24 24" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

function channelLabel(raw: string, kind: "instagram" | "telegram") {
  const handle = kind === "instagram"
    ? raw.match(/instagram\.com\/([A-Za-z0-9._]+)/i)?.[1]
    : raw.match(/(?:t\.me|telegram\.me)\/([A-Za-z0-9_]+)/i)?.[1] ?? raw.replace(/^@/, "");
  if (!handle) return raw;
  return kind === "instagram" ? `@${handle}` : `@${handle.replace(/^@/, "")}`;
}

function Mark({ tone, children }: { tone: "on" | "wait" | "off" | "added"; children: string }) {
  return <span className={`cabinet-mark cabinet-mark--${tone}`}>{children}</span>;
}

function Row({
  icon,
  label,
  value,
  added,
  verified,
  gender,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  added: boolean;
  verified: boolean | null;
  gender: "m" | "f";
}) {
  const addedLabel = gender === "f" ? "Добавлена" : "Добавлен";
  const missingLabel = gender === "f" ? "Не добавлена" : "Не добавлен";
  const verifiedLabel = gender === "f" ? "Подтверждена" : "Подтверждён";
  const waitingLabel = gender === "f" ? "Не подтверждена" : "Не подтверждён";
  return (
    <div className="cabinet-contact">
      <span className="cabinet-contact__icon" aria-hidden="true">{icon}</span>
      <span className="cabinet-contact__name">{label}</span>
      {added ? <span className="cabinet-contact__value">{value}</span> : <span className="cabinet-contact__value" />}
      <span className="cabinet-contact__marks">
        {added ? <Mark tone="added">{addedLabel}</Mark> : <Mark tone="off">{missingLabel}</Mark>}
        {verified === true ? <Mark tone="on">{verifiedLabel}</Mark> : null}
        {verified === false ? <Mark tone="wait">{waitingLabel}</Mark> : null}
      </span>
    </div>
  );
}

export function TrainerContactStatus({ profile }: { profile: OwnTrainerProfile }) {
  const phone = profile.phone.trim();
  const instagram = profile.instagram.trim();
  const telegram = profile.telegram.trim();
  const email = profile.email.trim();

  return (
    <div className="cabinet-contacts">
      <Row
        icon={<LineIcon path={PHONE_PATH} />}
        label="Телефон"
        value={phone}
        added={Boolean(phone)}
        verified={phone ? profile.phoneVerified : null}
        gender="m"
      />
      <Row
        icon={<InstagramIcon />}
        label="Instagram"
        value={channelLabel(instagram, "instagram")}
        added={Boolean(instagram)}
        verified={null}
        gender="m"
      />
      <Row
        icon={<TelegramIcon />}
        label="Telegram"
        value={channelLabel(telegram, "telegram")}
        added={Boolean(telegram)}
        verified={telegram ? profile.telegramVerified : null}
        gender="m"
      />
      <Row
        icon={<LineIcon path={MAIL_PATH} />}
        label="Почта"
        value={email}
        added={Boolean(email)}
        verified={email ? profile.emailVerified : null}
        gender="f"
      />
    </div>
  );
}
