# SMS.BY — транзакционные SMS trenio.by

Провайдер **[SMS.BY](https://sms.by)** (Беларусь): транзакционные SMS, массовые рассылки, альфа-имена. Коннектор OTP есть в коде (`src/lib/sms/`, вход по SMS в `/auth/login`, подтверждение номера в `/account`). Боевая отправка только при `SMS_BY_ENABLED=true` + баланс + альфа-имя.

Кабинет: [app.sms.by](https://app.sms.by) · API-ключ: [app.sms.by/user-api/token](https://app.sms.by/user-api/token) · Альфа-имена: [app.sms.by/alphanames](https://app.sms.by/alphanames).

Документация: [sms.by/api-docs](https://sms.by/api-docs/auth) (v2.5). PHP-пример: [github.com/sms-by-code/sms-php](https://github.com/sms-by-code/sms-php) — порт логики на Node, PHP не подключаем.

## Env

Серверное `.env` (не git, не `VITE_*`):

```env
SMS_BY_ENABLED=true
SMS_BY_API_KEY=
SMS_BY_ALPHANAME_ID=7027
```

| Переменная | Назначение |
|------------|------------|
| `SMS_BY_API_KEY` | API-ключ (в доке SMS.BY параметр `token`) |
| `SMS_BY_ALPHANAME_ID` | ID альфа-имени **TRENIO.BY** — `7027`. Пустое значение в коде тоже подставляет этот ID |
| `SMS_BY_ENABLED` | `true`, когда коннектор реально отправляет SMS |

**Не класть** ключ в `VITE_*` и в git. Не логировать ключ.

У SMS.BY **нет sandbox** и нет параметра `test: true`. «Тест» = реальное SMS на свой номер после баланса. Не путать с платёжными `test: true`.

## Авторизация

Два разных «токена» у SMS.BY:

1. **Login token** — `POST /remote-api/login` (логин/пароль кабинета).
2. **API key** — то, что лежит в `SMS_BY_API_KEY`. Им пользуются методы `/api/v1/…` как `token=`.

Логин/пароль кабинета в env **не** храним. Базовый URL: `https://app.sms.by/api/v1/{command}`.

## Телефоны

Формат API: **`375XXXXXXXXX`** (без `+`, без пробелов). В интерфейсе поле сразу с `+375`.

## Методы, которые используем

| Сценарий | Метод |
|----------|--------|
| OTP / одно уведомление одному номеру | `POST /api/v1/sendQuickSMS` (`src/lib/sms/sms-by.server.ts`) |
| Один текст → много номеров | `createSmsMessage` + `sendSMS` |
| Кампания ≥10 / персональные / отложенная | `POST /api/v1/sendBulkSms` |

Статус: `checkSMS` / `statusBulkSms`. HTTP-ошибки: 400, 404, 429, 500; при 429 — backoff.

Вход по SMS для неизвестного номера отвечает той же фразой, что и для существующего. Подтверждение телефона в кабинете говорит прямо, если SMS не ушло.

## Не ломать

- Не коммитить `SMS_BY_API_KEY`
- Не слать тестовые кампании на боевую базу без явной команды
- Отправитель только **TRENIO.BY** (`7027`) с того же аккаунта SMS.BY, что и BronxGym. Другое имя не подставлять
- Ключ общий с BronxGym и лежит только в серверном `.env`
