import type { ReactNode } from "react";

import { joinTrainerName } from "@/lib/catalog/trainer-name";

export function TrainerName({
  firstName,
  lastName,
  className,
  empty = "Тренер",
  afterName,
}: {
  firstName: string;
  lastName?: string | null;
  className?: string;
  empty?: string;
  /** Sits after the surname, or after the given name when there is no surname. */
  afterName?: ReactNode;
}) {
  const given = firstName.trim();
  const family = lastName?.trim() ?? "";
  const title = joinTrainerName(given, family) || empty;
  const lines = given || family ? [given, family].filter(Boolean) : [empty];
  return (
    <span className={className ? `trainer-name ${className}` : "trainer-name"} title={title}>
      {lines.map((line, index) => (
        <span className="trainer-name__line" key={index}>
          <span className="trainer-name__text">{line}</span>
          {index === lines.length - 1 ? afterName : null}
        </span>
      ))}
    </span>
  );
}
