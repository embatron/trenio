export type TrainerGender = "male" | "female" | "";

const MALE_GIVEN = new Set([
  "никита",
  "илья",
  "кузьма",
  "лука",
  "фома",
  "савва",
  "данила",
  "муса",
  "nikita",
  "ilya",
]);

const AMBIGUOUS = new Set(["саша", "женя", "валя", "шура", "sasha", "zhenya"]);

function fold(value: string) {
  return value.trim().toLowerCase().replace(/ё/g, "е");
}

/** Male or female from the imported given name. Ambiguous names stay empty. */
export function inferTrainerGender(firstName: string, text = ""): TrainerGender {
  const corpus = fold(text);
  if (/тренерка|инструкторка|спортсменка/.test(corpus)) return "female";
  const name = fold(firstName);
  if (!name || AMBIGUOUS.has(name)) return "";
  if (MALE_GIVEN.has(name)) return "male";
  if (/[аяa]$/.test(name)) return "female";
  if (/[бвгджзклмнпрстфхцчшщйьbcdfghjklmnpqrstvwxyz]$/.test(name)) return "male";
  return "";
}

export function genderAddress(gender: string): "был" | "была" | "был(а)" {
  if (gender === "female") return "была";
  if (gender === "male") return "был";
  return "был(а)";
}

export function genderLabel(gender: string): "женский" | "мужской" | "не определён" {
  if (gender === "female") return "женский";
  if (gender === "male") return "мужской";
  return "не определён";
}
