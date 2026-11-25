/** How a trainer account was verified or how the card was published. The journal message names this. */
export const TRAINER_PROOFS = [
  "letter",
  "email-code",
  "password-letter",
  "sms",
  "telegram",
  "google",
  "yandex",
  "apple",
  "signup",
  "door-letter",
  "door-sms",
  "door-google",
  "door-yandex",
  "staff-card",
  "staff-switch",
  "staff-bind",
  "staff-sms",
  "cabinet",
] as const;

export type TrainerProof = (typeof TRAINER_PROOFS)[number];

const PROOF_LABEL: Record<TrainerProof, string> = {
  letter: "письмо на почту",
  "email-code": "код на почту",
  "password-letter": "письмо для пароля",
  sms: "код из SMS",
  telegram: "номер из Telegram",
  google: "Google",
  yandex: "Яндекс",
  apple: "Apple",
  signup: "код при создании кабинета",
  "door-letter": "письмо по короткой ссылке",
  "door-sms": "SMS по короткой ссылке",
  "door-google": "Google на короткой ссылке",
  "door-yandex": "Яндекс на короткой ссылке",
  "staff-card": "карточка сотрудника",
  "staff-switch": "переключатель сотрудника",
  "staff-bind": "привязка почты сотрудником",
  "staff-sms": "код из SMS в карточке сотрудника",
  cabinet: "кабинет тренера",
};

export function staffProof(via: TrainerProof) {
  return via === "staff-card" || via === "staff-switch" || via === "staff-bind" || via === "staff-sms";
}

function who(via: TrainerProof) {
  return staffProof(via) ? "сотрудник" : "тренер";
}

function roleNote(via: TrainerProof) {
  return staffProof(via) ? "Сотрудник." : "Не сотрудник.";
}

/** The logs tab shows this sentence. The clock is the row time. */
export function verificationMessage(via: TrainerProof) {
  return `Верификацию включил ${who(via)}. Канал: ${PROOF_LABEL[via]}. ${roleNote(via)}`;
}

export function verificationClearedMessage() {
  return "Верификацию снял сотрудник. Канал: карточка сотрудника. Сотрудник.";
}

/** Publish or the return to unpublished. Verification is named so the two facts stay in one row. */
export function publishMessage(via: TrainerProof, published: boolean, verified: boolean) {
  const seal = verified ? "Верификация включена." : "Верификация не включена.";
  if (!published) return `Публикацию снял ${who(via)}. Канал: ${PROOF_LABEL[via]}. ${roleNote(via)} ${seal}`;
  return `Опубликовал ${who(via)}. Канал: ${PROOF_LABEL[via]}. ${roleNote(via)} ${seal}`;
}
