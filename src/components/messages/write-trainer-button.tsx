import { TrainerContactIcons } from "@/components/messages/trainer-contact-icons";

/** Card and profile contact row. The visible label «Написать» is gone; the direct icon keeps that name. */
export function WriteTrainerButton({
  slug,
  telegram,
  instagram,
}: {
  slug: string;
  className?: string;
  telegram?: string;
  instagram?: string;
}) {
  return <TrainerContactIcons slug={slug} telegram={telegram} instagram={instagram} />;
}
