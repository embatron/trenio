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
}: {
  slug: string;
  className: string;
  children: ReactNode;
  label: string;
}) {
  const { user, messaging } = useRouteContext({ from: "__root__" });
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
export function CardDirectLink({ slug, className }: { slug: string; className: string }) {
  return (
    <DirectMessageLink slug={slug} className={className} label="Написать">
      <DirectMark />
    </DirectMessageLink>
  );
}

/** Primary profile CTA directly below the trainer photos. */
export function ProfileDirectButton({ slug }: { slug: string }) {
  return (
    <DirectMessageLink slug={slug} className="profile-message-cta" label="Написать тренеру">
      <DirectMark />
      <span>Написать тренеру</span>
    </DirectMessageLink>
  );
}
