/** Given name and surname are stored apart. `fullName` is only their join. */

export function joinTrainerName(firstName: string, lastName?: string | null) {
  return [firstName.trim(), (lastName ?? "").trim()].filter(Boolean).join(" ");
}

export function splitTrainerName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: (parts[0] ?? "").slice(0, 100),
    lastName: parts.slice(1).join(" ").slice(0, 100),
  };
}

export function trainerNameParts(firstName: string, lastName: string, fullName = "") {
  const first = firstName.trim();
  const last = lastName.trim();
  if (first || last) {
    return {
      firstName: first.slice(0, 100),
      lastName: last.slice(0, 100),
      fullName: joinTrainerName(first, last),
    };
  }
  const split = splitTrainerName(fullName);
  return { ...split, fullName: joinTrainerName(split.firstName, split.lastName) };
}
