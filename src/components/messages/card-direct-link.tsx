import { useRouteContext } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { DirectMark } from "@/components/messages/direct-mark";
import { directMessageHref } from "@/lib/auth/roles";
import { recordTrainerContactClick } from "@/lib/catalog/trainer-contact-client";

function DirectMessageLink({
  slug,
  className,
  children,
  label,
  locked = false,
}: {
  slug: string;
  className: string;
  children: ReactNode;
  label: string;
  /** Gray and inert while the trainer account is not confirmed. */
  locked?: boolean;
}) {
  const { user, messaging } = useRouteContext({ from: "__root__" });
  if (locked) {
    return (
      <span
        className={`${className} is-quiet`}
        aria-disabled="true"
        aria-label={`${label}. Аккаунт не подтверждён`}
        title="Аккаунт не подтверждён"
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </span>
    );
  }
  if (messaging.ownedSlugs.includes(slug)) return null;
  const thread = `/account/messages?trainer=${encodeURIComponent(slug)}`;
  const href = user
    ? directMessageHref(user.roles, slug)
    : `/auth/login?redirect=${encodeURIComponent(thread)}`;
  return (
    <a
      className={className}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        recordTrainerContactClick(slug, "message");
      }}
    >
      {children}
    </a>
  );
}

/** Outline plane on a trainer card. Same thread as «Написать» on the profile. */
export function CardDirectLink({ slug, className, locked = false }: { slug: string; className: string; locked?: boolean }) {
  return (
    <DirectMessageLink slug={slug} className={className} label="Написать" locked={locked}>
      <DirectMark />
    </DirectMessageLink>
  );
}

/** Primary profile CTA directly below the trainer photos. */
export function ProfileDirectButton({ slug, locked = false }: { slug: string; locked?: boolean }) {
  return (
    <DirectMessageLink slug={slug} className="profile-message-cta" label="Написать тренеру" locked={locked}>
      <DirectMark />
      <span>Написать тренеру</span>
    </DirectMessageLink>
  );
}
