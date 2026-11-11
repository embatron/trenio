import { useRouteContext } from "@tanstack/react-router";

import { DirectMark } from "@/components/messages/direct-mark";
import { directMessageHref } from "@/lib/auth/roles";
import { recordTrainerContactClick } from "@/lib/catalog/trainer-contact-client";

/** Outline plane on a trainer card. Same thread as «Написать» on the profile. */
export function CardDirectLink({ slug, className }: { slug: string; className: string }) {
  const { user, messaging } = useRouteContext({ from: "__root__" });
  if (messaging.ownedSlugs.includes(slug)) return null;
  const thread = `/account/messages?trainer=${encodeURIComponent(slug)}`;
  const href = user ? directMessageHref(user.roles, slug) : `/auth/login?redirect=${encodeURIComponent(thread)}`;
  return (
    <a
      className={className}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Написать"
      title="Написать"
      onClick={(event) => {
        event.stopPropagation();
        recordTrainerContactClick(slug, "message");
      }}
    >
      <DirectMark />
    </a>
  );
}
