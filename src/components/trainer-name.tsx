import { joinTrainerName } from "@/lib/catalog/trainer-name";

export function TrainerName({
  firstName,
  lastName,
  className,
  empty = "Тренер",
}: {
  firstName: string;
  lastName?: string | null;
  className?: string;
  empty?: string;
}) {
  const given = firstName.trim();
  const family = lastName?.trim() ?? "";
  const title = joinTrainerName(given, family) || empty;
  return (
    <span className={className ? `trainer-name ${className}` : "trainer-name"} title={title}>
      {given || family ? (
        <>
          {given ? <span className="trainer-name__line">{given}</span> : null}
          {family ? <span className="trainer-name__line">{family}</span> : null}
        </>
      ) : (
        <span className="trainer-name__line">{empty}</span>
      )}
    </span>
  );
}
