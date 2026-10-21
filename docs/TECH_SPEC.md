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

IP берётся из `CF-Connecting-IP` или `X-Real-IP`. Если в запросе только локальный адрес (так у `trenio.local` за Apache), браузер один раз узнаёт свой публичный IP и сервер ищет его в той же базе. Город подставляется только когда это населённый пункт Беларуси. Результат и ручной выбор пишутся в cookie `trenio_place` на год. «Сбросить» очищает город и больше не подставляет его, пока посетитель не выберет населённый пункт снова. IP в cookie не хранится.

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
| `trainer_reviews`           | Отзыв авторизованного пользователя о тренере (один на пару user + slug). Статус: на модерации, опубликовано, отклонено. `moderation_note` виден автору |
| `user_favorites`            | Избранные тренеры и клубы авторизованного пользователя (один на пару user + тип + slug) |
| `trainer_profiles`          | Черновик карточки тренера: имя, текст, до четырёх видов спорта, один город Беларуси, цена и стаж от 1, Instagram, Telegram, до девяти фото и сертификаты. В каталог попадает только после публикации |

### 4.3 Server functions

Все мутации и приватные данные — через `createServerFn` в `src/lib/auth/functions.ts`:

- `getSessionFn`, `loginFn`, `signupFn`, `logoutFn`
- `requestSmsLoginFn`, `confirmSmsLoginFn`
- `loginWithTelegramFn`, `loginWithTelegramWebAppFn`, `getTelegramLoginConfigFn`
- `forgotPasswordFn`, `requestPasswordResetSmsFn`, `confirmPasswordResetSmsFn`
- `resetPasswordFn`, `verifyEmailFn`, `updateProfileFn` — имя и фамилия текущего аккаунта одним полем; `setAccountAvatarFn` — фото в `public/avatars/`
- `changePasswordFn` — смена пароля из кабинета по текущему паролю, текущая сессия сохраняется
- `requestAccountEmailCodeFn`, `confirmAccountEmailCodeFn` — смена почты кодом из письма
- `requestAccountPhoneCodeFn`, `confirmAccountPhoneCodeFn` — привязка телефона SMS-кодом
- `listTrainerReviewsFn`, `createTrainerReviewFn` — отзывы профиля тренера; создание только с сессией (`requireAuthMiddleware`). Новый отзыв уходит на модерацию
- `setTrainerReviewStatusFn` — публикация или отклонение отзыва, только `admin` и `superadmin`. Отклонение требует комментарий клиенту и шлёт ему письмо
- `listTrainerRatingSummariesFn` — средняя оценка и число опубликованных отзывов по тренерам для карточек каталога
- `listFavoritesFn`, `toggleFavoriteFn` — избранное только с сессией, без срока хранения. Список и переключение вызываются с клиента после отрисовки, без перезагрузки страницы. Гость уходит на вход. Счётчик в шапке виден вошедшему пользователю и ведёт на `/account/favorites`
- `getAdminShellFn`, `getAdminOverviewFn`, `getAdminTrainersFn`, `saveAdminTrainerFn`, `getAdminTrainerDetailFn`, `saveAdminTrainerPhotoFn`, `getAdminReviewsFn`, `getAdminAccountsFn`, `getAdminFinanceFn`, `getAdminSettingsFn` — отдельные серверные функции разделов `/admin/*` для `admin` и `superadmin`. Виды спорта — не больше четырёх категорий второго уровня. Город выбирается из населённых пунктов Беларуси. Цена и стаж — целые числа. Карточка `/admin/trainers/$slug` редактирует поля, до девяти фото, и показывает входы, события и данные профиля. Фото пишутся в `public/trainers/admin/{slug}/`. Оболочка кабинета одна, у пользователя и тренера свои маршруты: `/account/*`, `/trainer-admin`
- `getUserCabinetFn` — свои отзывы, телефон и статус телефона. Кабинет: `/account/reviews`, `/account/bookings`, `/account/favorites`, `/account/settings`
- `getHomeStatsFn` — блок «в цифрах» на главной: число профилей тренеров, виды спорта и города из `trainer_profiles`, средняя оценка опубликованных отзывов
- `getOwnTrainerProfileFn`, `saveOwnTrainerProfileFn` — черновик карточки тренера для ролей trainer и club
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
| `--layout-max` | `1240px` — ширина контента (header, footer, каталог) |
| `--layout-prose-max` | `760px` — узкий текст (blog, privacy) |
| `--layout-gutter` | `clamp(20px, 4vw, 36px)` — горизонтальные отступы |
| `--layout-section-y` | вертикальные отступы секций |
| `--layout-sidebar-w` | `280px` — колонка фильтров |
| `.layout-container` | центрированный контейнер с gutter |
| `.layout-with-sidebar` | фильтры 280px + контент, один контейнер с шапкой |
| `.card-grid`, `.clubs-grid`, `.categories-grid` | 3 колонки, с 960px — 2, с 640px — 1 |
| `.trainer-grid`, `.cat-grid`, `.city-grid`, `.sr-grid` | каталог тренеров: 4 колонки, с 960px — 2, с 640px — 1 |
| `.section-head`, `.section-title` | заголовки секций, размер `--fs-section`, вес `--fw-heading` |

Контейнер один: фон на всю ширину, содержимое `max-width: var(--layout-max)` и `padding-inline: var(--layout-gutter)`. Горизонтальный padding не ставится и на внешний блок, и на внутренний сразу. Горизонтальные ленты (иконки, карточки) используют `.layout-rail` и не доходят до края экрана. `--layout-gutter` включает `safe-area-inset`, viewport — `viewport-fit=cover`. Карточки тренеров описаны в `styles.css` и одинаковы на главной, в категориях и в городах.

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
| `.cursor/rules/layout-grid.mdc` | Главное правило вёрстки: одна сетка на всех экранах (`alwaysApply`) |
| `.cursor/rules/icons.mdc` | Линейные иконки, один глиф на смысл, спорт через `SportIcon` |
| `.cursor/rules/process-language.mdc` | Rules, skills, commands, hooks и `AGENTS.md` — английский; UI и `docs/` — русский |
| `.cursor/rules/visitor-place.mdc` | Город посетителя только через локальную GeoLite2; в поиске — этот город или «Минск»; виды спорта из таксономии |
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
