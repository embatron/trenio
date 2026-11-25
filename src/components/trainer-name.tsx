import type { ReactNode } from "react";

import { joinTrainerName } from "@/lib/catalog/trainer-name";

export function TrainerName({
  firstName,
  lastName,
  className,
  empty = "Тренер",
  mark,
}: {
  firstName: string;
  lastName?: string | null;
  className?: string;
  empty?: string;
  /** Sits on the surname, or on the given name when there is no surname. */
  mark?: ReactNode;
}) {
  const given = firstName.trim();
  const family = lastName?.trim() ?? "";
  const title = joinTrainerName(given, family) || empty;
  return (
    <span className={className ? `trainer-name ${className}` : "trainer-name"} title={title}>
      {given || family ? (
        <>
          {given ? <span className="trainer-name__line">{given}{family ? null : mark}</span> : null}
          {family ? <span className="trainer-name__line">{family}{mark}</span> : null}
        </>
      ) : (
        <span className="trainer-name__line">{empty}{mark}</span>
      )}
    </span>
  );
}
