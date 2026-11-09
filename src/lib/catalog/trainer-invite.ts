import { instagramGaps, renderInstagramMessage, welcomeHello } from "@/lib/site-texts/defaults";

/** Text an admin pastes into an Instagram direct message. One short link. */

export type InviteProfileFacts = {
  city: string;
  places: Array<{ city: string; district: string; address: string }>;
  address: string | null;
  priceFrom: number | null;
  photo: string;
  sports: number;
  phone: string;
  about: string;
  bio: string;
  experienceYears: number;
  formats: number;
  audiences: number;
  lastName: string;
};

const MISSING_LINES: Array<{ key: string; line: string; empty: (facts: InviteProfileFacts) => boolean }> = [
  { key: "city", line: "город", empty: (facts) => !facts.city.trim() },
  { key: "places", line: "места, где ты тренируешь", empty: (facts) => !hasPlace(facts) },
  { key: "price", line: "цена персональных занятий", empty: (facts) => facts.priceFrom == null || facts.priceFrom < 1 },
  { key: "photo", line: "фото", empty: (facts) => !facts.photo.trim() },
  { key: "sport", line: "вид спорта", empty: (facts) => facts.sports < 1 },
  { key: "phone", line: "телефон", empty: (facts) => !facts.phone.trim() },
  { key: "about", line: "как проходят тренировки", empty: (facts) => !facts.about.trim() },
  { key: "bio", line: "текст о себе", empty: (facts) => !facts.bio.trim() },
  { key: "experience", line: "стаж", empty: (facts) => facts.experienceYears < 1 },
  { key: "format", line: "формат занятий", empty: (facts) => facts.formats < 1 },
  { key: "audience", line: "с кем ты работаешь", empty: (facts) => facts.audiences < 1 },
];

function hasPlace(facts: InviteProfileFacts) {
  if (facts.address?.trim()) return true;
  return facts.places.some((place) => place.city.trim() || place.district.trim() || place.address.trim());
}

/** Lines for fields the import did not fill. Order is stable. */
export function inviteMissingLines(facts: InviteProfileFacts) {
  return MISSING_LINES.filter((item) => item.empty(facts)).map((item) => item.line);
}

export function trainerInviteMessage(input: {
  name: string;
  doorUrl: string;
  publicUrl: string;
  published: boolean;
  missing?: string[];
  template?: string;
}) {
  const hello = welcomeHello(input.name);
  if (input.published) {
    return [
      hello,
      "",
      "Твой профиль на Trenio уже опубликован:",
      input.publicUrl,
      "",
      "Короткая ссылка, если она была, теперь открывает эту же страницу.",
      "Статус публикации меняешь ты в кабинете.",
      "",
      "Мы делаем портал, чтобы людям было проще найти тебя и твои тренировки.",
    ].join("\n");
  }
  return renderInstagramMessage({
    template: input.template,
    hello,
    gaps: instagramGaps(input.missing ?? []),
    doorUrl: input.doorUrl,
  });
}
