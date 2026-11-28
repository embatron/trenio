import { useRouteContext } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

import { DirectMark } from "@/components/messages/direct-mark";
import { UnconfirmedContactDialog } from "@/components/messages/unconfirmed-contact-dialog";
import { directMessageHref } from "@/lib/auth/roles";
import { recordTrainerContactClick } from "@/lib/catalog/trainer-contact-client";

function DirectMessageLink({
  slug,
  className,
  children,
  label,
  locked = false,
  ask = false,
}: {
  slug: string;
  className: string;
  children: ReactNode;
  label: string;
  locked?: boolean;
  /** On a profile, the gray control opens the note. A catalog card stays inert. */
  ask?: boolean;
}) {
  const { user, messaging } = useRouteContext({ from: "__root__" });
  const [open, setOpen] = useState(false);
  if (locked && ask) {
    return (
      <>
        <button
          type="button"
          className={`${className} is-quiet`}
          aria-label={`${label}. Аккаунт не подтверждён`}
          title="Аккаунт не подтверждён"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setOpen(true);
          }}
        >
          {children}
        </button>
        <UnconfirmedContactDialog slug={slug} open={open} onOpenChange={setOpen} />
      </>
    );
  }
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
export function CardDirectLink({
  slug,
  className,
  locked = false,
  ask = false,
}: {
  slug: string;
  className: string;
  locked?: boolean;
  ask?: boolean;
}) {
  return (
    <DirectMessageLink slug={slug} className={className} label="Написать" locked={locked} ask={ask}>
      <DirectMark />
    </DirectMessageLink>
  );
}

/** Primary profile CTA directly below the trainer photos. */
export function ProfileDirectButton({ slug, locked = false }: { slug: string; locked?: boolean }) {
  return (
    <DirectMessageLink slug={slug} className="profile-message-cta" label="Написать тренеру" locked={locked} ask>
      <DirectMark />
      <span>Написать тренеру</span>
    </DirectMessageLink>
  );
}
