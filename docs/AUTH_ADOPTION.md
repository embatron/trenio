# Auth-контракт — статус внедрения

Целевое состояние: [AUTH.md](./AUTH.md). SMS: [sms-by.md](./sms-by.md).

## Сделано

- Signup без пароля, письмо `/auth/set-password`, generic success вместо `EMAIL_TAKEN`
- Pending-пользователь (`pending_verification`, `password_hash` nullable) до клика по ссылке
- Новый reset / email-change / set-password отзывает unused токены того же user
- Смена email через `/auth/confirm-email`; `users.email` не меняется до клика
- Honeypot `company_url`, rate limit по `X-Real-IP`
- SMS.BY коннектор и OTP-вход. Кабинет `/account` показывает телефон; форма подтверждения в кабинете не подключена
- Сессии: новый вход не закрывает остальные. `revokeAllUserSessions` остаётся на сбросе пароля. Выход закрывает только текущую cookie

## Не тащить из других проектов

SQLite `session_version`, две cookie member/admin, bcryptjs, публичный ник в URL, чужой бренд в UI.
