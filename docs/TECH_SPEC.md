# Trenio.by — техническая спецификация

Единый инженерный документ проекта. Продуктовый контекст — [PRODUCT.md](./PRODUCT.md), доменная модель — [ACCOUNT_MODEL.md](./ACCOUNT_MODEL.md).

**Домен:** trenio.by · **Рынок:** Беларусь · **MVP:** каталог тренеров и клубов, конверсия через контактный клик.

---

## 1. Архитектура

```
Browser / PWA client
        │
        ▼
TanStack Start (SSR + client hydration)
        │
        ├── File routes (src/routes/*.tsx)
        ├── Server functions (src/lib/auth/functions.ts, …)
        └── Middleware (src/start.ts, src/auth/middleware.ts)
        │
        ▼
PostgreSQL (Drizzle ORM, src/db/)
```

| Слой           | Технология                           | Путь                                                |
| -------------- | ------------------------------------ | --------------------------------------------------- |
| Framework      | TanStack Start + TanStack Router     | `src/routes/`, `src/router.tsx`                     |
| UI             | React 19, Tailwind CSS v4, shadcn/ui | `src/components/ui/`                                |
| Site UI        | Кастомные компоненты каталога        | `src/components/site-chrome.tsx`, `auth-styles.tsx` |
| SSR entry      | Nitro / Cloudflare preset (Lovable)  | `src/server.ts`, `vite.config.ts`                   |
| Start instance | Request middleware                   | `src/start.ts`                                      |
| Auth (server)  | Sessions, password, RBAC             | `src/auth/`                                         |
| Auth (RPC)     | `createServerFn`                     | `src/lib/auth/functions.ts`                         |
| DB             | Drizzle + postgres.js                | `src/db/`                                           |
| Hooks / utils  | Shared client helpers                | `src/lib/`, `src/hooks/`                            |

**Node.js:** >= 22.12 (TanStack Start). **Package manager:** npm (есть `bun.lock`, но npm — основной для CI/seed).

---

## 2. Структура репозитория

```
src/
├── routes/              # Единственное место для страниц (не src/pages/)
├── components/
│   ├── ui/              # shadcn primitives
│   ├── site-chrome.tsx  # Header, footer, mega menu
│   ├── auth-styles.tsx
│   └── sport-icon.tsx   # Реестр и рендер category icons
├── auth/                # Server-only auth (НЕ src/server/auth/)
├── lib/
│   ├── auth/            # Schemas, server fns, client hooks
│   └── catalog/         # Таксономия спорта и shared catalog data
├── db/
│   ├── schema/          # Drizzle tables
│   └── seed.ts
├── hooks/               # use-mobile.tsx (breakpoint 768px)
├── styles.css           # Design tokens, utilities
├── router.tsx
├── server.ts            # SSR wrapper
└── start.ts

docs/                    # Документация (см. §12)
.cursor/                 # Rules, skills, hooks для Cursor
AGENTS.md                # Entry point для агентов
```

**Запрещено:** `src/pages/`, Next.js `app/`, ручное редактирование `src/routeTree.gen.ts`.

**Lovable:** не force-push, не amend/squash уже запушенных коммитов (см. `AGENTS.md`).

---

## 3. Маршрутизация

File-based TanStack Router: `src/routes/<name>.tsx` → URL.

| Паттерн              | Пример                             |
| -------------------- | ---------------------------------- |
| `index.tsx`          | `/`                                |
| `search.tsx`         | `/search`                          |
| `trainers.$slug.tsx` | `/trainers/:slug`                  |
| `auth.login.tsx`     | `/auth/login`                      |
| `__root.tsx`         | App shell, session in `beforeLoad` |

Root context: `{ queryClient, user: PublicUser | null }` — сессия через `getSessionFn`.

### Город посетителя

На страницах категории (`/categories/yoga` и вложенные) город в фильтре подставляется сам, если IP удалось сопоставить с населённым пунктом Беларуси. Библиотека — [`ip-location-api`](https://www.npmjs.com/package/ip-location-api) с бесплатной базой GeoLite2 City (язык `ru`, режим `smallMemory`). База лежит в `data/geoip/` и не коммитится. Перед выкладкой: `npm run geoip:update`.

IP берётся из `CF-Connecting-IP` или `X-Real-IP`. Если в запросе только локальный адрес (так у `trenio.local` за Apache), браузер один раз узнаёт свой публичный IP и сервер ищет его в той же базе. Город подставляется только когда это населённый пункт Беларуси. Результат и ручной выбор пишутся в cookie `trenio_place` на год. «Сбросить» очищает город и больше не подставляет его, пока посетитель не выберет населённый пункт снова. IP в cookie не хранится. В базе те же поля, что просит `ILA_FIELDS`: страна, город, радиус и координаты. Координаты нужны странице `/map`, чтобы поставить ближе тех, чьё место тренировки ближе к точке IP. В cookie координаты не пишутся.

Поиск на главной, в шапке, на страницах 403 и 404 и при пустой выдаче — одна форма `CatalogSearchForm`. Виды спорта берутся из таксономии (`src/lib/catalog/sport-taxonomy.ts`). Город в поле — определённый или сохранённый населённый пункт, иначе «Минск». Тот же город выбран в фильтре категории; в шапке категории поиск заранее заполнен названием вида спорта.

База GeoLite2 создана MaxMind и доступна на [maxmind.com](https://www.maxmind.com).

---

## 4. Backend и база данных

### 4.1 PostgreSQL

- **Dev:** Docker Compose, порт **5433**, `DATABASE_URL` в `.env`
- **ORM:** Drizzle (`drizzle-kit push` для dev, `generate`/`migrate` для prod)
- **Команды:** `npm run db:up`, `db:push`, `db:seed`, `db:studio`

### 4.2 Схема (MVP auth)

| Таблица                     | Назначение                                              |
| --------------------------- | ------------------------------------------------------- |
| `users`                     | email, phone, password_hash, avatar_path, telegram_user_id, status, last_signup_intent |
| `user_roles`                | RBAC: user, trainer, club, admin, superadmin            |
| `sessions`                  | HttpOnly cookie, срок 3 недели (token hash)             |
| `password_reset_tokens`     | Сброс пароля (30 мин)                                   |
| `email_verification_tokens` | Подтверждение e-mail                                    |
| `auth_otp_challenges`       | SMS-коды: login, verify_phone, register, reset_password |
| `trainer_reviews`           | Отзыв авторизованного пользователя о тренере (один на пару user + slug). Статус: на модерации, опубликовано, отклонено. `moderation_note` виден автору. Переписка тренера и автора отзыва — `messages`; кнопка «Ответить» только у того, чей сейчас ход |
| `user_favorites`            | Избранные тренеры и клубы авторизованного пользователя (один на пару user + тип + slug) |
| `conversations`, `messages`, `conversation_reads`, `message_reports`, `blocked_pairs` | Переписка пользователь ↔ опубликованный профиль. См. §4.6 |
| `trainer_profiles`          | Черновик карточки тренера: имя и фамилия отдельными полями (`first_name`, `last_name`; `full_name` — их склейка), текст, до четырёх видов спорта, один город Беларуси, цена и стаж от 1, Instagram, Telegram, почта контакта без подтверждения, до девяти фото и до пяти сертификатов или дипломов с подписью (PNG, JPG, PDF и другие файлы; на профиле ссылка в новое окно). Импорт кладёт в виды спорта только то, чему человек учит; увлечение остаётся отдельно. Текст актуального «Обо мне» копируется в описание, номер телефона из этого текста убирается. Поле телефона любой карточки — `+375 33 637-62-68`. Импорт без согласия остаётся черновиком («на модерации»). Род определяется при импорте по имени и виден только сотруднику. Привязка здоровается этим именем и выбирает «был» или «была». Адрес страницы и ник равны Instagram (`/trainers/{handle}`), старые именные адреса перенаправляются. До трёх мест тренировок в Беларуси лежит в `training_places`. Первое место дублируется в `address`, `address_lat`, `address_lng`, `geocode_status`, см. §4.7. Ссылка `/trainers/claim/{token}` видна сотруднику на странице редактирования, пока карточка не опубликована и не привязана: иконка копирует полный адрес, проверка сверяет, что она ещё открывает непривязанную карточку. В таблице тренеров этой проверки нет. После публикации или привязки адрес из кабинета пропадает и открывает публичный профиль. Привязка — после оферты, ника, почты и пароля: аккаунт сразу активен, тренер попадает на редактирование карточки. Ник уникален и не редактируется, смена только через поддержку. Сложность пароля показывается при вводе. Карточка профиля выезжает при первом открытии. В каталог карточка попадает только после публикации |
| `geocode_cache`             | Кеш ответов Nominatim: координаты, город, район, улица и код страны. Ключ — нормализованный запрос. См. §4.7 |

### 4.3 Server functions

Все мутации и приватные данные — через `createServerFn` в `src/lib/auth/functions.ts`:

- `getSessionFn`, `loginFn`, `signupFn`, `logoutFn`
- `requestSmsLoginFn`, `confirmSmsLoginFn`
- `loginWithTelegramFn`, `loginWithTelegramWebAppFn`, `getTelegramLoginConfigFn`
- `forgotPasswordFn`, `requestPasswordResetSmsFn`, `confirmPasswordResetSmsFn`
- `resetPasswordFn`, `verifyEmailFn`, `updateProfileFn` — имя и фамилия текущего аккаунта двумя полями; `setAccountAvatarFn` — фото в `public/avatars/`
- `changePasswordFn` — смена пароля из кабинета по текущему паролю, текущая сессия сохраняется
- `requestAccountEmailCodeFn`, `confirmAccountEmailCodeFn` — смена почты кодом из письма
- `requestAccountPhoneCodeFn`, `confirmAccountPhoneCodeFn` — привязка телефона SMS-кодом. Подтверждённый номер записывается и в карточку тренера, если она есть
- `listTrainerReviewsFn`, `createTrainerReviewFn` — отзывы профиля тренера; создание только с сессией (`requireAuthMiddleware`). Новый отзыв уходит на модерацию
- `setTrainerReviewStatusFn` — публикация или отклонение отзыва, только `admin` и `superadmin`. Отклонение требует комментарий клиенту и шлёт ему письмо
- `listTrainerRatingSummariesFn` — средняя оценка и число опубликованных отзывов по тренерам для карточек каталога
- `listFavoritesFn`, `toggleFavoriteFn` — избранное только с сессией, без срока хранения. Список и переключение вызываются с клиента после отрисовки, без перезагрузки страницы. Гость уходит на вход. Счётчик в шапке виден вошедшему пользователю и ведёт на `/account/favorites`
- `getAdminShellFn`, `getAdminOverviewFn`, `getAdminTrainersFn`, `saveAdminTrainerFn`, `getAdminTrainerDetailFn`, `saveAdminTrainerPhotoFn`, `getAdminReviewsFn`, `getAdminAccountsFn`, `getAdminFinanceFn`, `getAdminSettingsFn` — отдельные серверные функции разделов `/admin/*` для `admin` и `superadmin`. Виды спорта — не больше четырёх категорий второго уровня. Город выбирается из населённых пунктов Беларуси. Цена и стаж — целые числа. Карточка `/admin/trainers/$slug` редактирует поля в том же порядке, что и кабинет тренера: имя и заголовок в одной строке, город отдельным полем, стаж выше контактов, Instagram и Telegram внизу, формат занятий и аудитория из таксономии, до девяти фото. Телефон карточки равен телефону привязанного аккаунта и подтверждается SMS. Входы, логи и прочие данные видит только сотрудник. «О себе» и «О занятиях» — тот же короткий редактор, что у отзыва: жирный, курсив, списки. Фото можно перетащить: первое становится главным. При сохранении фото сервер пишет оригинал до 1600 px и производные `s128`, `c320`, `c640`, `w960` рядом с ним, без увеличения и без метаданных. Карточки, поиск, профиль и аватары запрашивают производный файл и возвращаются к оригиналу, если его ещё нет. Файлы лежат в `public/trainers/` и `public/avatars/`. Dev-сервер отдаёт их с диска, не дожидаясь перезапуска. Оболочка кабинета одна, у пользователя и тренера свои маршруты: `/account/*`, `/trainer-admin`
- `getUserCabinetFn` — свои отзывы, телефон и статус телефона. Кабинет: `/account/reviews`, `/account/messages`, `/account/bookings`, `/account/favorites`, `/account/settings`
- Переписка — `src/lib/messages/functions.ts`, все вызовы `POST` и `requireAuthMiddleware`. См. §4.6
- `getHomeStatsFn` — блок «в цифрах» на главной: число профилей тренеров, виды спорта и города из `trainer_profiles`, средняя оценка опубликованных отзывов
- `getOwnTrainerProfileFn`, `saveOwnTrainerProfileFn` — черновик карточки тренера для ролей trainer и club. Сохранение до трёх адресов геокодирует текст, если координаты ещё не подтверждены. Адрес вне Беларуси отклоняется. См. §4.7
- `suggestAddress` — подсказки адреса только по Беларуси и на русском, `POST`, `requireAuthMiddleware`, не чаще одного запроса в секунду на пользователя. Ответ — `{ displayName, city, district, street, lat, lng }`, без сырых полей Nominatim
- `getTrainerAddressFn` — публичные места карточки для `/trainers/$slug`: город, район, адрес и координаты, координаты только если статус `ok`
- `listMapTrainersFn` — опубликованные тренеры для `/map`: имя, фото, виды спорта, аудитория, формат, цена, стаж, рейтинг и места со статусом `ok`. Без телефона и почты. Черновик и адрес без точки не попадают в ответ
- `adminGeocodeTrainer` — повторное геокодирование сохранённых мест, `POST`, только `admin` и `superadmin`, кеш по сроку не используется
- Сортировка «По популярности»: `отзывы × 10 + средняя оценка`. Трекера просмотров профиля нет

Вход `/auth/login?redirect=` принимает путь на этом же сайте и возвращает туда после входа. Внешние адреса отбрасываются.

**Правило:** auth проверяется в middleware/handler server fn, не только в route `beforeLoad`.

### 4.4 Безопасность auth

- Пароли: **scrypt** (Node.js crypto), min 8 + цифра + заглавная
- Timing-safe login (dummy hash при несуществующем email)
- Session rotation при login / reset password
- Cookie: HttpOnly, SameSite=Lax, Secure в production
- Password reset: одинаковый ответ (anti-enumeration)
- SMS login и сброс пароля — только для номера с `phone_verified_at`; неизвестный номер получает тот же ответ, что и существующий
- Telegram login — только для уже привязанного `telegram_user_id`; виджет (10 мин) и Mini App `initData` (24 ч)
- Лимиты попыток входа и OTP — в памяти процесса
- Dev: `AUTH_DEV_LOG_EMAILS=true` — ссылки в console; OTP в non-production возвращается в UI, если SMS.BY не включён

### 4.5 Роли

| Роль         | Регистрация  | Назначение                          |
| ------------ | ------------ | ----------------------------------- |
| `user`       | Публичная    | Ищет тренера                        |
| `trainer`    | Публичная    | Тренер                              |
| `club`       | Публичная    | Представитель клуба                 |
| `admin`      | Seed / staff | Модерация                           |
| `superadmin` | Seed / staff | Полный доступ (+ финансы в будущем) |

### 4.6 Сообщения

Контракт для агентов: [.cursor/rules/messages.mdc](../.cursor/rules/messages.mdc), навык [.cursor/skills/trenio-messages/SKILL.md](../.cursor/skills/trenio-messages/SKILL.md).

Диалог только между аккаунтом и одним `trainer_profiles`. Произвольный поиск собеседника и переписка user↔user не входят в модель. Одна открытая пара: уникальный индекс `(user_id, trainer_profile_id) WHERE status = 'open'`. Повторная отправка с тем же `client_id` не создаёт второе сообщение (`UNIQUE (conversation_id, client_id)`, `ON CONFLICT DO NOTHING`). `messages.id` — `bigint GENERATED ALWAYS AS IDENTITY`. Видимый текст первого сообщения инициатора — до 1000 символов, дальше до 4000. Считаются символы без разметки, один эмодзи — один символ. В поле тот же короткий редактор, что у отзыва: жирный, курсив, списки и эмодзи, включая откровенные и все оттенки кожи. Перед записью HTML чистится тем же набором тегов. В колонке хранится до 12000 символов уже с тегами. У своих сообщений под временем стоит «Доставлено», а после отметки прочтения собеседником — «Прочитано». `last_message_at` обновляется в той же транзакции, что и вставка сообщения. На карточке и в блоке «Как со мной связаться» после отзывов ссылка на диалог — иконка, она открывает `/account/messages?trainer={slug}` в новой вкладке. Рядом иконки телефона (`tel:`), Instagram, Telegram и почты. Соцсети и почта открываются в новой вкладке, телефон остаётся на странице. В блоке профиля рядом с трубкой виден номер. Своей карточке иконка диалога не показывается.

Кто что видит: инициатор — свои диалоги; владелец профиля (роль trainer или club) — диалоги этого профиля; admin и superadmin читают тред в `/admin/messages` и не пишут в чужой. Закрывает владелец профиля или сотрудник: диалог остаётся в списке, новые сообщения не отправляются. Скрыть или удалить переписку нельзя. Для обоих участников она пропадает только вместе с удалённым аккаунтом.

Лимиты отправки в памяти процесса, тот же `consumeRateLimit`, что у входа: 10 сообщений в минуту и 300 в сутки на отправителя. Отдельно один пользователь за календарные сутки по Минску может написать не больше чем 10 разным тренерам: считаются его сообщения в диалогах, где он инициатор. Повтор тому же тренеру в эти сутки лимит не тратит, ответ владельца профиля не считается. Одиннадцатому тренеру сервер отказывает, а кабинет показывает попап «Лимит на сегодня». Первое сообщение инициатора не длиннее 1000 видимых символов. Ошибки — на русском.

Список стоит по последней активности: сверху самый свежий диалог. Если в адресе нет конкретной переписки, открывается верхняя строка. Наведение подсвечивает строку и красит имя. В списке и в шапке диалога имя и фамилия стоят в одну строку. Слова «Открыта» и «Закрыта» рядом с именем нет: закрытый диалог объясняется в поле ввода. Текст в поле — 14px. Адрес `?trainer=` не перебивается, пока этот диалог ещё создаётся. Клиент держит открытым поток опроса: непрочитанное для шапки и сайдбара, список и открытый тред — каждые 5 с через TanStack Query, плюс сразу при возврате на вкладку. Скрытая вкладка (`document.visibilityState`) опрос останавливает. WebSocket и SSE нет. Схема не меняется, если позже появится свой PartyKit.

Письмо получателю уходит через Resend или лог (`AUTH_DEV_LOG_EMAILS` / не production), одно на паузу в 2 минуты, без текста переписки. Если получатель — владелец профиля и у него есть `telegram_user_id`, то же короткое уведомление шлёт бот входа (`TELEGRAM_LOGIN_BOT_TOKEN`). Если `last_read_at` этой переписки свежее 30 секунд, уведомление не отправляется. Первый счётчик непрочитанного берётся в root loader, дальше тот же запрос повторяется, пока вкладка открыта. В шапке у конверта всегда видно число. В сайдбаре кабинета маленькие числа стоят у избранного, отзывов и сообщений. Кабинет admin и superadmin шире (`1680px`, класс `layout-staff`), кабинет тренера и клиента остаются на `1240px`.

Жалоба пишется в `message_reports` (одна на пару сообщение + автор). Сотрудник отклоняет её, закрывает диалог или блокирует пару: `blocked_pairs` и статус `closed`.

### 4.7 Адрес и геокодирование

Тренер или клуб указывает до трёх мест, где проходят занятия. Блок называется «Места, где я тренирую». Страна фиксирована: Беларусь. Адрес другой страны не сохраняется. Подсказки и разбор адреса идут на русском. Координаты считает сервер, браузер к геокодеру не ходит.

| Поле | Смысл |
| --- | --- |
| `training_places` | JSON до трёх мест: город, район, точный адрес, широта, долгота, `geocodeStatus` |
| `address` | Строка первого места. `NULL`, если мест нет. Нужна индексу координат |
| `address_lat`, `address_lng` | Координаты первого места с точкой, `double precision`, иначе `NULL` |
| `geocode_status` | Статус первого места: `ok`, `not_found` или `pending`. `NULL`, если мест нет |

Индекс `(address_lat, address_lng)` заложен для будущего поиска «рядом». Сейчас по радиусу никто не ищет.

Геокодер — публичный Nominatim, `https://nominatim.openstreetmap.org/search`, `countrycodes=by`, `format=jsonv2`, `addressdetails=1`, `accept-language=ru`. В заголовке `User-Agent` указан Trenio.by и `Accept-Language: ru`. Это требование [usage policy](https://operations.osmfoundation.org/policies/nominatim/): не больше одного запроса в секунду с IP сервера и обязательный кеш. Процесс выдерживает паузу 1100 мс между исходящими вызовами. Таймаут 8 секунд. Ошибка сети или HTTP не роняет сохранение профиля. Если белорусский поиск пуст, сервер один раз проверяет страну без фильтра. Код страны не `by` — сохранение отклоняется. Неизвестный текст остаётся со статусом `not_found`.

`geocode_cache.query_norm` — нижний регистр без пунктуации. В строке лежат `lat`, `lng`, `display_name`, `city`, `district`, `street`, `country_code`, `created_at`. `country_code` не `by` значит, что запрос вне Беларуси. Запись старше 180 дней считается просроченной и запрашивается снова. Пустой ответ тоже кешируется, чтобы повторы не били внешний сервис. Подсказка кладёт в кеш и сам запрос, и каждое `display_name`. В подсказках нет адресов других стран.

Сохранение профиля:

1. Пустой список обнуляет зеркало первого места.
2. То же место со статусом `ok` повторно не геокодируется.
3. Новый текст без подходящей точки из кеша уходит в Nominatim. Нашли в Беларуси — `ok`, город, район и улица из ответа, уточнённые координаты. Не нашли — текст остаётся, `not_found`, координат нет. Сервис недоступен — текст остаётся, `pending`, координат нет. Адрес другой страны отклоняет всё сохранение.

Подсказки в каждом из трёх полей: пауза 400 мс, до пяти строк. Пункт «Не нашли адрес? Просто сохраните текст» пишет строку без координат (`pending`, затем догеокодизация на сервере). Выбор подсказки заполняет город, район, улицу и координаты; сервер принимает координаты, только если они совпали с кешем.

На публичной карточке места — плашки с иконкой адреса: город и улица в одной строке, без района. Нажатие на плашку с координатами переводит карту на эту точку, не уходя со страницы. Карта Leaflet (тайлы `tile.openstreetmap.org`, zoom 16, без зума колёсиком, без строки Leaflet и © OpenStreetMap) рисуется в браузере, если есть хотя бы одна точка. Пока скрипт карты не пришёл, на месте карты стоит блок той же высоты. Кнопка «Проложить маршрут» открывает Яндекс Карты: `https://yandex.by/maps/?rtext=~{lat},{lng}&rtt=auto` для выбранного места. Без координат остаётся список.

Общая карта — `/map`, функция `listMapTrainersFn`. На неё попадают только опубликованные профили и только места со статусом `ok`. Тайлы те же, колесо мыши карту не масштабирует. Фильтр один: горизонтальная полоса направлений первого уровня. Идентификатор вида второго уровня в `?sports=` поднимается до родителя. Метка по нажатию открывает короткое превью. На ширине от 960px карта слева, карточки справа в две колонки. Уже этого карта стоит над списком, а карточки идут в одну колонку до 640px и в две после. Сетка показывает только тех, чья метка внутри кадра. Порядок — расстояние до точки IP в Беларуси. Если координаты не пришли или страна не Беларусь, и карта, и порядок берутся от центра Минска. Кнопка «Моё местоположение» вызывает Geolocation API и не ходит во внешний геокодер. Точка вне Беларуси карту не сдвигает. Несколько тренеров в одной точке делят метку. Если скрипт карты не загрузился, на месте карты остаётся список тех же тренеров, без обрезки по кадру. Без сети тайлы не приходят, метки и карточки остаются.

В кабинете сотрудника у каждого места бейдж статуса и общая кнопка «Перегеокодировать». Она игнорирует срок кеша. Точку на карте руками не ставят.

Если объём вырастет и публичный Nominatim перестанет подходить, запасной путь — свой Photon (геокодер на данных OpenStreetMap) за тем же серверным интерфейсом. Ключи Яндекса и Google не используются.

---

## 5. Frontend и UI

### 5.1 Design system

- CSS variables в `src/styles.css` (`--primary`, `--dark`, …)
- Scoped auth styles: `AuthStyles` component
- shadcn/ui для форм и dialogs — `src/components/ui/`
- Breakpoint mobile: **768px** (`useIsMobile` in `src/hooks/use-mobile.tsx`)

### 5.2 Данные (текущее состояние)

Каталог клубов пустой. Четыре тренера из Instagram опубликованы в `src/lib/catalog/published-trainers.ts` и видны на главной, в Минске, в своих категориях и в поиске. Импорт по-прежнему пишет черновики в `data/instagram-trainers/`. Целевое состояние всего каталога — PostgreSQL + server functions / loaders.

| Область                 | Статус                   |
| ----------------------- | ------------------------ |
| Auth                    | PostgreSQL ✓             |
| Каталог тренеров/клубов | Пустой, без mock (миграция в планах) |
| Filament admin          | Не подключён             |
| Email (Resend)          | Dev log only             |

---

## 6. PWA — обязательное требование проекта

**Trenio.by — 100% PWA-совместимый проект.** Любая новая фича должна учитывать installable web app.

### 6.1 Целевой чеклист

| #   | Требование                                                               | Статус           |
| --- | ------------------------------------------------------------------------ | ---------------- |
| 1   | Web App Manifest (`name`, `icons`, `theme_color`, `display: standalone`) | ✓ (`public/manifest.webmanifest`) |
| 2   | Service Worker (precache + runtime caching)                              | Planned          |
| 3   | Offline fallback route (`/offline`)                                      | Planned          |
| 4   | HTTPS в production                                                       | Required         |
| 5   | Responsive icons 192/512                                                 | ✓ (`public/icons/`) |
| 6   | `viewport` + `theme-color` meta                                          | ✓ (`__root.tsx`) |
| 7   | Не ломать SW при deploy (cache busting)                                  | Required         |
| 8   | Auth cookies совместимы с PWA scope                                      | ✓ SameSite=Lax   |

### 6.2 Правила реализации

- Не использовать APIs, недоступные в SW context, без fallback
- Статика для UI и PWA — `public/` (категории, логотип, иконки, manifest; service worker — planned, §6.3)
- Новые route — учитывать offline UX (empty state, не белый экран)
- SSR страницы должны hydrates без ошибок в standalone mode
- Карта мест тренера ходит в тайлы OpenStreetMap из браузера. Без сети остаётся список адресов, блок карты не схлопывается
- Общая карта `/map` ходит в те же тайлы. Если скрипт карты не загрузился, на месте карты остаётся список тренеров той же высоты. Без сети тайлы не приходят, метки остаются
- Тестировать: Lighthouse PWA audit, «Add to Home Screen» на Android/iOS

### 6.3 Planned paths

```
public/sw.js (или vite-plugin-pwa)
src/routes/offline.tsx
```

### 6.4 Текущие статические assets

| Путь                                      | Назначение                                                                                    |
| ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| `public/logo.webp`                        | Словесный знак в шапке на светлом фоне (503×128)                                              |
| `public/logo-on-dark.webp`                | Тот же знак для тёмного подвала: белый `trenio`, коралловый `.by`                              |
| `public/logo-knockout.webp`               | Белый знак поверх кораллового героя категории                                                  |
| `public/favicon.ico`, `public/favicon-32.png`, `public/apple-touch-icon.png` | Иконка вкладки и Apple touch (квадрат с «t»)                                    |
| `public/icons/icon-192.png`, `icon-512.png` | PWA-иконки, фон `#f04b50`                                                                      |
| `public/manifest.webmanifest`             | Имя, `theme_color`, `display: standalone`, иконки 192/512                                      |
| `public/images/categories/*-card.webp`    | Карточки «Категории спорта» на главной (~720×480 WebP)                                        |
| `public/images/categories/*.webp`         | Featured image родительских категорий на `/categories/$slug` (~960×640 WebP)                    |
| `public/images/popular/*.webp`            | Legacy thumbnails (заменены на `categories/`; можно удалить после проверки)                   |
| `public/data/belarus-settlements.json`    | Населённые пункты Беларуси для фильтра локации (GeoNames, ~21k, CC-BY 4.0)                    |
| `assets/images/*.jpg`                     | Исходники для оптимизации (не отдаются напрямую клиенту)                                      |

---

## 7. Mobile-first — обязательное требование

**Mobile-first:** дизайн и реализация начинаются с viewport ≤768px, затем расширяются.

### 7.1 Breakpoint

- Mobile: `< 768px` (`useIsMobile`, Tailwind `md:` = 768px)
- Touch targets: min **44×44px** для интерактива
- Auth forms: single column on mobile (`auth-styles.tsx` media queries)

### 7.2 Чеклист для UI-изменений

| #   | Проверка                                                         |
| --- | ---------------------------------------------------------------- |
| 1   | Layout не ломается на 320px width                                |
| 2   | Нет horizontal scroll на mobile (кроме intentional carousels)    |
| 3   | Header/burger/mega menu работают на touch                        |
| 4   | Forms usable с виртуальной клавиатурой                           |
| 5   | Font size ≥14px для body, контраст WCAG AA                       |
| 6   | Sticky/fixed elements не перекрывают контент                     |
| 7   | `@media (max-width: …)` или Tailwind mobile-first (`sm:`, `md:`) |
| 8   | Desktop-only features имеют mobile alternative                   |

### 7.3 Компоненты

- `SiteHeader` — responsive nav, login icon
- `AuthStyles` — mobile grid collapse
- shadcn `Sheet` / `Drawer` — предпочтительны для mobile overlays
- Карточки каталога — stack on mobile, grid on desktop

### 7.4 Единая layout-сетка

Обязательное правило для всех экранов: `.cursor/rules/layout-grid.mdc`. Глобальные токены и утилиты в `src/styles.css`:

| Token / class | Значение |
| --- | --- |
| `--layout-max` | `1240px` — ширина контента (header, footer, каталог, кабинет тренера и пользователя) |
| `--layout-staff-max` | `1680px` — кабинет `/admin` (роли admin и superadmin). Класс `.layout-staff` подменяет `--layout-max`, шапка и подвал на этих страницах стоят на той же кромке |
| `--layout-prose-max` | `760px` — узкий текст (blog, privacy) |
| `--layout-gutter` | `clamp(20px, 4vw, 36px)` — горизонтальные отступы |
| `--layout-section-y` | вертикальные отступы секций |
| `--layout-sidebar-w` | `280px` — колонка фильтров |
| `.layout-container` | центрированный контейнер с gutter |
| `.layout-with-sidebar` | фильтры 280px + контент, один контейнер с шапкой |
| `.card-grid`, `.clubs-grid`, `.categories-grid` | 3 колонки, с 960px — 2, с 640px — 1 |
| `.trainer-grid`, `.cat-grid`, `.favorites-grid` | каталог тренеров и избранное в кабинете: 3 колонки, с 960px — 2, с 640px — 1 |
| `.city-grid`, `.sr-grid` | города и поиск: 4 колонки, с 960px — 2, с 640px — 1 |
| `.section-head`, `.section-title` | заголовки секций, размер `--fs-section`, вес `--fw-heading` |

Контейнер один: фон на всю ширину, содержимое `max-width: var(--layout-max)` и `padding-inline: var(--layout-gutter)`. Кабинет администратора и суперадминистратора шире: оболочка `/admin` носит класс `.layout-staff` и читает `--layout-staff-max`. Каталог, `/account` и `/trainer-admin` остаются на `--layout-max`. Горизонтальный padding не ставится и на внешний блок, и на внутренний сразу. Горизонтальные ленты (иконки, карточки) используют `.layout-rail` и не доходят до края экрана. `--layout-gutter` включает `safe-area-inset`, viewport — `viewport-fit=cover`. Карточки тренеров описаны в `styles.css` и одинаковы на главной, в категориях и в городах.

Типографика тоже в `src/styles.css`. Новые заголовки берут токены, а не `font-weight: 800–900`.

| Token | Значение | Роль |
| --- | --- | --- |
| `--fs-display` | до 48px | герой главной |
| `--fs-page` | до 40px | h1 каталога, города, клубов |
| `--fs-section` | до 26px | h2 секций |
| `--fs-card` | 16px | названия карточек |
| `--fw-heading` | 700 | h1–h2 |
| `--fw-title` | 650 | h3, названия карточек |
| `--fw-ui` | 600 | кнопки, чипы, ссылки |
| `--fw-body` | 450 | текст, базовый размер 15px |
| `--card-radius` | 22px | карточки, панели, баннеры, фильтры, FAQ |
| `--radius-control` | 12px | кнопки, поля, селекты |
| `--radius-tile` | 14px | иконки и логотипы в квадрате |

Чипы и пилюли — `999px`, круги — `50%`. Для интерфейса не использовать `--radius-md` из shadcn: без локального переопределения он даёт около 8px и расходится с карточками.

Breakpoint для collapse sidebar/grid: **`960px`**. Новые страницы используют CSS-переменные, не хардкод `1200`/`1360px`.

---

## 8. Environment variables

| Variable              | Назначение                          |
| --------------------- | ----------------------------------- |
| `DATABASE_URL`        | PostgreSQL connection string        |
| `SESSION_SECRET`      | Session signing (min 32 chars prod) |
| `APP_ORIGIN`          | CSRF origin check                   |
| `APP_URL`             | Absolute URLs (email, reset links)  |
| `AUTH_DEV_LOG_EMAILS` | Log auth links and review mail to console |
| `RESEND_API_KEY`      | Ключ Resend. Без него письма отзывов пишутся в лог |
| `MAIL_FROM`           | Адрес отправителя, например `Trenio <reviews@trenio.by>` |
| `SMS_BY_ENABLED`      | `true` включает отправку через SMS.BY |
| `SMS_BY_API_KEY`      | Токен SMS.BY                        |
| `SMS_BY_ALPHANAME_ID` | ID альфа-имени отправителя          |
| `TELEGRAM_LOGIN_BOT_TOKEN` | Токен бота входа в Telegram    |
| `TELEGRAM_LOGIN_BOT_USERNAME` | Username бота без `@`          |
| `VITE_TELEGRAM_LOGIN_BOT_USERNAME` | Тот же username для виджета на клиенте |

См. `.env.example`. `.env` в `.gitignore`.

---

## 9. Команды разработки

```bash
nvm use 22
npm install
npm run db:up && npm run db:push && npm run db:seed
npm run geoip:update # база GeoLite2 City в data/geoip
npm run dev          # http://trenio.local (Apache → порт 8080)
npm run build
npm run lint
npm run format
```

Локальный хост: `http://trenio.local` (`127.0.0.9` в `/etc/hosts`, Apache → `127.0.0.1:8080`). `APP_ORIGIN` и `APP_URL` в `.env` указывают на этот адрес.

**Seed accounts:** `admin@trenio.by` / `Admin1234`, `super@trenio.by` / `Super1234`, `client@trenio.by` / `Pa55word!` (роль `user`, один отзыв о Сергее Овсянникове)

---

## 10. Качество кода

- TypeScript strict
- ESLint + Prettier
- Zod validation на server functions
- `@/` path alias → `src/`
- Минимальный diff, следовать существующим паттернам файла
- Не импортировать `src/auth/`, `src/db/` из client components (TanStack import protection)

---

## 11. SEO и SSR

- Один H1 на страницу, meta через route `head()`
- SSR через TanStack Start — loaders isomorphic, DB только в server fn
- Canonical URLs при индексируемых страницах (см. PRODUCT.md §6)

---

## 12. Карта документации

| Файл                                   | Когда обновлять                         |
| -------------------------------------- | --------------------------------------- |
| [README.md](./README.md)               | Routes, команды, auth summary           |
| [PRODUCT.md](./PRODUCT.md)             | Продукт, таксономия, SEO, UX            |
| [ACCOUNT_MODEL.md](./ACCOUNT_MODEL.md) | Сущности, intent, claim                 |
| **TECH_SPEC.md** (этот файл)           | Архитектура, стек, PWA/mobile, auth, DB |
| `AGENTS.md`                            | Entry point, Lovable constraints        |
| `.cursor/rules/*.mdc`                  | Cursor agent rules                      |
| `.cursor/skills/*/SKILL.md`            | Workflows (PWA audit, mobile, docs)     |

### Триггеры синхронизации docs

| Изменение в коде      | Обновить                              |
| --------------------- | ------------------------------------- |
| Новый/удалён route    | `docs/README.md` § routes             |
| Auth / roles / schema | `TECH_SPEC.md` §4, `ACCOUNT_MODEL.md` |
| Новая env variable    | `TECH_SPEC.md` §8, `.env.example`     |
| PWA assets / SW       | `TECH_SPEC.md` §6 checklist           |
| Продуктовая логика    | `PRODUCT.md`                          |
| Cursor rules/hooks    | `TECH_SPEC.md` §13                    |

---

## 13. Cursor automation

| Артефакт                    | Назначение                                                            |
| --------------------------- | --------------------------------------------------------------------- |
| `.cursor/rules/layout-grid.mdc` | Главное правило вёрстки: одна сетка. Каталог — `--layout-max`, кабинет `/admin` — `--layout-staff-max` (`alwaysApply`) |
| `.cursor/rules/icons.mdc` | Линейные иконки, один глиф на смысл, спорт через `SportIcon` |
| `.cursor/rules/process-language.mdc` | Rules, skills, commands, hooks и `AGENTS.md` — английский; UI и `docs/` — русский |
| `.cursor/rules/visitor-place.mdc` | Город посетителя только через локальную GeoLite2; в поиске — этот город или «Минск»; виды спорта из таксономии |
| `.cursor/rules/breadcrumbs.mdc` | Последний пункт хлебных крошек — `var(--primary)`; класс `is-current` и `aria-current="page"` |
| `.cursor/rules/`            | Persistent rules (layout grid, icons, PWA, mobile, stack)             |
| `.cursor/skills/`           | Workflows: feature dev, PWA audit, mobile audit, docs sync, импорт тренеров из Instagram |
| `.cursor/commands/hooks.md` | Slash-команда `/hooks` — сетка, иконки, PWA, mobile, docs             |
| `.cursor/commands/import-instagram-trainers.md` | Slash-команда `/import-instagram-trainers` — черновики профилей из публичных ссылок Instagram |
| `.cursor/hooks.json`        | Пустой (авто-hooks отключены); legacy-скрипты в `.cursor/hooks/`      |

Чеклист запускается вручную: `/hooks` в чате Cursor. См. `.cursor/hooks/README.md`.

---

## 14. Roadmap (инженерный)

1. ~~PostgreSQL + auth~~ ✓
2. PWA manifest + service worker + offline route
3. Каталог тренеров и клубов в DB (mock убран, страницы пустые)
4. Email provider (Resend)
5. Filament admin API
6. TrainerProfile / ClubBranch entities (ACCOUNT_MODEL)
