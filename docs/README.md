# Trenio.by — документация

**Trenio.by** — спортивный каталог Беларуси для поиска тренеров, клубов и секций по городу и виду спорта.

Основная конверсия MVP — клик по контакту тренера или клуба. Проект не является маркетплейсом, системой бронирования или сервисом проверки квалификации.

## Документы

| Документ | Содержание |
| --- | --- |
| [TECH_SPEC.md](./TECH_SPEC.md) | **Техническая спецификация** — архитектура, auth, DB, PWA, mobile-first |
| [PRODUCT.md](./PRODUCT.md) | Продукт, маршруты, таксономия, SEO, UX-профили, empty states, админка |
| [ACCOUNT_MODEL.md](./ACCOUNT_MODEL.md) | Доменная модель: Account, TrainerProfile, ClubBranch, intent-onboarding, claim |

**Разделение:** TECH_SPEC — _как устроен код_; PRODUCT — _что видит пользователь_; ACCOUNT_MODEL — _сущности и onboarding_.

Cursor automation: `.cursor/rules/`, `.cursor/skills/`, `.cursor/hooks.json` (см. TECH_SPEC §13).

## Стек и команды

| Слой | Технология |
| --- | --- |
| Framework | TanStack Start + TanStack Router (file-based routes) |
| UI | React 19, Tailwind CSS v4, shadcn/ui (`src/components/ui/`) |
| SSR | `src/server.ts`, `src/start.ts` |

```bash
nvm use 22          # TanStack Start требует Node >= 22.12
npm install
npm run db:up       # PostgreSQL в Docker (порт 5433)
cp .env.example .env
npm run db:push     # применить схему
npm run db:seed     # admin@trenio.by / super@trenio.by
npm run dev         # http://localhost:8080
npm run build
npm run preview
npm run lint
```

## Auth и роли

| Роль | Назначение |
| --- | --- |
| `user` | Обычный пользователь (ищет тренера) |
| `trainer` | Тренер |
| `club` | Представитель клуба / филиала |
| `admin` | Администратор и модератор |
| `superadmin` | Суперадмин (в т.ч. будущий доступ к финансам) |

Публичная регистрация: `user`, `trainer`, `club`. Роли `admin` / `superadmin` — только через seed или назначение staff.

Маршруты auth: `/auth/login`, `/auth/signup`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email`.

Подробнее о доменной модели — [ACCOUNT_MODEL.md](./ACCOUNT_MODEL.md).

## Структура репозитория

```
src/
├── routes/           # Страницы (TanStack file routes)
├── components/       # UI-компоненты (site-chrome, auth-styles, ui/)
├── auth/             # Server auth (service, session, middleware)
├── lib/
│   └── auth/         # Schemas, server fns, client hooks
├── db/               # Drizzle schema, seed
├── hooks/
├── styles.css
├── router.tsx
├── server.ts
└── start.ts

docs/                 # Документация
.cursor/              # Rules, skills, hooks
AGENTS.md             # Entry point для агентов
```

`src/routeTree.gen.ts` генерируется автоматически — не редактировать вручную.
Не создавать `src/pages/` или Next.js-style `app/` — маршруты только в `src/routes/`.

## Реализованные маршруты (frontend)

| URL | Файл | Назначение |
| --- | --- | --- |
| `/` | `index.tsx` | Главная, поиск, популярные направления |
| `/search` | `search.tsx` | Результаты поиска с фильтрами |
| `/category/$slug` | `category.$slug.tsx` | Страница спортивной категории |
| `/city/$slug` | `city.$slug.tsx` | Спорт в городе |
| `/trainers/$slug` | `trainers.$slug.tsx` | Профиль тренера |
| `/clubs` | `clubs.index.tsx` | Каталог клубов |
| `/clubs/$slug` | `clubs.$slug.tsx` | Профиль клуба / филиала |
| `/blog/$slug` | `blog.$slug.tsx` | Статья блога |
| `/auth/login` | `auth.login.tsx` | Вход |
| `/auth/signup` | `auth.signup.tsx` | Регистрация |
| `/auth/forgot-password` | `auth.forgot-password.tsx` | Запрос сброса пароля |
| `/auth/reset-password` | `auth.reset-password.tsx` | Новый пароль по токену |
| `/auth/verify-email` | `auth.verify-email.tsx` | Подтверждение e-mail |
| `/trainer-admin` | `trainer-admin.tsx` | Кабинет тренера (прототип) |
| `/privacy` | `privacy.tsx` | Политика конфиденциальности |

Полная целевая карта URL (включая backend и SEO-страницы каталога) — в [PRODUCT.md §3](./PRODUCT.md#3-маршруты-и-страницы).

## Обновление документации

При добавлении маршрута или изменении продукта:

1. Обновить route-файл в `src/routes/`
2. Синхронизировать таблицу «Реализованные маршруты» в этом файле
3. При изменении доменной модели или auth-flow — обновить [ACCOUNT_MODEL.md](./ACCOUNT_MODEL.md)
4. При изменении таксономии, SEO или UX-правил — обновить [PRODUCT.md](./PRODUCT.md)
