const DOMAIN_TITLE: Record<string, string> = {
  auth: "Вход",
  email: "Письмо",
  sms: "SMS",
  account: "Аккаунт",
  form: "Форма",
  map: "Карта",
  geo: "Гео",
  api: "API",
  system: "Система",
  message: "Сообщение",
  ajax: "AJAX",
  client: "Браузер",
  admin: "Админка",
  catalog: "Каталог",
};

const OUTCOME_TITLE: Record<string, string> = {
  success: "успех",
  failure: "ошибка",
  denied: "отказ",
  skipped: "пропуск",
};

export type JournalLine = {
  at: string;
  title: string;
  detail: string;
};

export function journalLine(row: {
  createdAt: Date;
  domain: string;
  action: string;
  outcome: string | null;
  message: string;
  errorCode: string | null;
  level: string;
}): JournalLine {
  const domain = DOMAIN_TITLE[row.domain] ?? row.domain;
  const outcome = row.outcome ? OUTCOME_TITLE[row.outcome] ?? row.outcome : "";
  return {
    at: row.createdAt.toISOString(),
    title: `${domain}: ${row.message}`.slice(0, 180),
    detail: [row.level, row.action, outcome, row.errorCode].filter(Boolean).join(" · "),
  };
}
