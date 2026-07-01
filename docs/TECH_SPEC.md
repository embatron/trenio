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

| Слой | Технология | Путь |
| --- | --- | --- |
| Framework | TanStack Start + TanStack Router | `src/routes/`, `src/router.tsx` |
| UI | React 19, Tailwind CSS v4, shadcn/ui | `src/components/ui/` |
| Site UI | Кастомные компоненты каталога | `src/components/site-chrome.tsx`, `auth-styles.tsx` |
| SSR entry | Nitro / Cloudflare preset (Lovable) | `src/server.ts`, `vite.config.ts` |
| Start instance | Request middleware | `src/start.ts` |
| Auth (server) | Sessions, password, RBAC | `src/auth/` |
| Auth (RPC) | `createServerFn` | `src/lib/auth/functions.ts` |
| DB | Drizzle + postgres.js | `src/db/` |
| Hooks / utils | Shared client helpers | `src/lib/`, `src/hooks/` |

**Node.js:** >= 22.12 (TanStack Start). **Package manager:** npm (есть `bun.lock`, но npm — основной для CI/seed).

---

## 2. Структура репозитория

```
src/
├── routes/              # Единственное место для страниц (не src/pages/)
├── components/
│   ├── ui/              # shadcn primitives
│   ├── site-chrome.tsx  # Header, footer, mega menu
│   └── auth-styles.tsx
├── auth/                # Server-only auth (НЕ src/server/auth/)
├── lib/
│   └── auth/            # Schemas, server fns, client hooks
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

| Паттерн | Пример |
| --- | --- |
| `index.tsx` | `/` |
| `search.tsx` | `/search` |
| `trainers.$slug.tsx` | `/trainers/:slug` |
| `auth.login.tsx` | `/auth/login` |
| `__root.tsx` | App shell, session in `beforeLoad` |

Root context: `{ queryClient, user: PublicUser | null }` — сессия через `getSessionFn`.

---

## 4. Backend и база данных

### 4.1 PostgreSQL

- **Dev:** Docker Compose, порт **5433**, `DATABASE_URL` в `.env`
- **ORM:** Drizzle (`drizzle-kit push` для dev, `generate`/`migrate` для prod)
- **Команды:** `npm run db:up`, `db:push`, `db:seed`, `db:studio`

### 4.2 Схема (MVP auth)

| Таблица | Назначение |
| --- | --- |
| `users` | email, phone, password_hash, status, last_signup_intent |
| `user_roles` | RBAC: user, trainer, club, admin, superadmin |
| `sessions` | HttpOnly cookie sessions (token hash) |
| `password_reset_tokens` | Сброс пароля (30 мин) |
| `email_verification_tokens` | Подтверждение e-mail |

### 4.3 Server functions

Все мутации и приватные данные — через `createServerFn` в `src/lib/auth/functions.ts`:

- `getSessionFn`, `loginFn`, `signupFn`, `logoutFn`
- `forgotPasswordFn`, `resetPasswordFn`, `verifyEmailFn`

**Правило:** auth проверяется в middleware/handler server fn, не только в route `beforeLoad`.

### 4.4 Безопасность auth

- Пароли: **scrypt** (Node.js crypto), min 8 + цифра + заглавная
- Timing-safe login (dummy hash при несуществующем email)
- Session rotation при login / reset password
- Cookie: HttpOnly, SameSite=Lax, Secure в production
- Password reset: одинаковый ответ (anti-enumeration)
- Dev: `AUTH_DEV_LOG_EMAILS=true` — ссылки в console

### 4.5 Роли

| Роль | Регистрация | Назначение |
| --- | --- | --- |
| `user` | Публичная | Ищет тренера |
| `trainer` | Публичная | Тренер |
| `club` | Публичная | Представитель клуба |
| `admin` | Seed / staff | Модерация |
| `superadmin` | Seed / staff | Полный доступ (+ финансы в будущем) |

---

## 5. Frontend и UI

### 5.1 Design system

- CSS variables в `src/styles.css` (`--primary`, `--dark`, …)
- Scoped auth styles: `AuthStyles` component
- shadcn/ui для форм и dialogs — `src/components/ui/`
- Breakpoint mobile: **768px** (`useIsMobile` in `src/hooks/use-mobile.tsx`)

### 5.2 Данные (текущее состояние)

Каталог (тренеры, клубы, поиск) — **inline mock** в route-файлах. Целевое состояние — PostgreSQL + server functions / loaders.

| Область | Статус |
| --- | --- |
| Auth | PostgreSQL ✓ |
| Каталог тренеров/клубов | Mock (миграция в планах) |
| Filament admin | Не подключён |
| Email (Resend) | Dev log only |

---

## 6. PWA — обязательное требование проекта

**Trenio.by — 100% PWA-совместимый проект.** Любая новая фича должна учитывать installable web app.

### 6.1 Целевой чеклист

| # | Требование | Статус |
| --- | --- | --- |
| 1 | Web App Manifest (`name`, `icons`, `theme_color`, `display: standalone`) | Planned |
| 2 | Service Worker (precache + runtime caching) | Planned |
| 3 | Offline fallback route (`/offline`) | Planned |
| 4 | HTTPS в production | Required |
| 5 | Responsive icons 192/512 | Planned |
| 6 | `viewport` + `theme-color` meta | ✓ (`__root.tsx`) |
| 7 | Не ломать SW при deploy (cache busting) | Required |
| 8 | Auth cookies совместимы с PWA scope | ✓ SameSite=Lax |

### 6.2 Правила реализации

- Не использовать APIs, недоступные в SW context, без fallback
- Статика и icons — `public/` (создать при добавлении PWA)
- Новые route — учитывать offline UX (empty state, не белый экран)
- SSR страницы должны hydrates без ошибок в standalone mode
- Тестировать: Lighthouse PWA audit, «Add to Home Screen» на Android/iOS

### 6.3 Planned paths

```
public/manifest.webmanifest
public/icons/icon-192.png
public/icons/icon-512.png
public/sw.js (или vite-plugin-pwa)
src/routes/offline.tsx
```

---

## 7. Mobile-first — обязательное требование

**Mobile-first:** дизайн и реализация начинаются с viewport ≤768px, затем расширяются.

### 7.1 Breakpoint

- Mobile: `< 768px` (`useIsMobile`, Tailwind `md:` = 768px)
- Touch targets: min **44×44px** для интерактива
- Auth forms: single column on mobile (`auth-styles.tsx` media queries)

### 7.2 Чеклист для UI-изменений

| # | Проверка |
| --- | --- |
| 1 | Layout не ломается на 320px width |
| 2 | Нет horizontal scroll на mobile (кроме intentional carousels) |
| 3 | Header/burger/mega menu работают на touch |
| 4 | Forms usable с виртуальной клавиатурой |
| 5 | Font size ≥14px для body, контраст WCAG AA |
| 6 | Sticky/fixed elements не перекрывают контент |
| 7 | `@media (max-width: …)` или Tailwind mobile-first (`sm:`, `md:`) |
| 8 | Desktop-only features имеют mobile alternative |

### 7.3 Компоненты

- `SiteHeader` — responsive nav, login icon
- `AuthStyles` — mobile grid collapse
- shadcn `Sheet` / `Drawer` — предпочтительны для mobile overlays
- Карточки каталога — stack on mobile, grid on desktop

---

## 8. Environment variables

| Variable | Назначение |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Session signing (min 32 chars prod) |
| `APP_ORIGIN` | CSRF origin check |
| `APP_URL` | Absolute URLs (email, reset links) |
| `AUTH_DEV_LOG_EMAILS` | Log auth links to console |

См. `.env.example`. `.env` в `.gitignore`.

---

## 9. Команды разработки

```bash
nvm use 22
npm install
npm run db:up && npm run db:push && npm run db:seed
npm run dev          # http://localhost:8080
npm run build
npm run lint
npm run format
```

**Seed accounts:** `admin@trenio.by` / `Admin1234`, `super@trenio.by` / `Super1234`

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

| Файл | Когда обновлять |
| --- | --- |
| [README.md](./README.md) | Routes, команды, auth summary |
| [PRODUCT.md](./PRODUCT.md) | Продукт, таксономия, SEO, UX |
| [ACCOUNT_MODEL.md](./ACCOUNT_MODEL.md) | Сущности, intent, claim |
| **TECH_SPEC.md** (этот файл) | Архитектура, стек, PWA/mobile, auth, DB |
| `AGENTS.md` | Entry point, Lovable constraints |
| `.cursor/rules/*.mdc` | Cursor agent rules |
| `.cursor/skills/*/SKILL.md` | Workflows (PWA audit, mobile, docs) |

### Триггеры синхронизации docs

| Изменение в коде | Обновить |
| --- | --- |
| Новый/удалён route | `docs/README.md` § routes |
| Auth / roles / schema | `TECH_SPEC.md` §4, `ACCOUNT_MODEL.md` |
| Новая env variable | `TECH_SPEC.md` §8, `.env.example` |
| PWA assets / SW | `TECH_SPEC.md` §6 checklist |
| Продуктовая логика | `PRODUCT.md` |
| Cursor rules/hooks | `TECH_SPEC.md` §13 |

---

## 13. Cursor automation

| Артефакт | Назначение |
| --- | --- |
| `.cursor/rules/` | Persistent rules (PWA, mobile, stack) |
| `.cursor/skills/` | Workflows: feature dev, PWA audit, mobile audit, docs sync |
| `.cursor/hooks.json` | Session context, post-edit reminders, stop audit |

Hooks запускаются автоматически — см. `.cursor/hooks/README.md`.

---

## 14. Roadmap (инженерный)

1. ~~PostgreSQL + auth~~ ✓
2. PWA manifest + service worker + offline route
3. Миграция mock-каталога в DB
4. Email provider (Resend)
5. Filament admin API
6. TrainerProfile / ClubBranch entities (ACCOUNT_MODEL)
