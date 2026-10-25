# Trenio.by — документация

**Trenio.by** — спортивный каталог Беларуси для поиска тренеров, клубов и секций по городу и виду спорта.

Основная конверсия MVP — клик по контакту тренера или клуба. Проект не является маркетплейсом, системой бронирования или сервисом проверки квалификации.

## Документы

| Документ                               | Содержание                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| [TECH_SPEC.md](./TECH_SPEC.md)         | **Техническая спецификация** — архитектура, auth, DB, PWA, mobile-first        |
| [PRODUCT.md](./PRODUCT.md)             | Продукт, маршруты, таксономия, SEO, UX-профили, empty states, админка          |
| [ACCOUNT_MODEL.md](./ACCOUNT_MODEL.md) | Доменная модель: Account, TrainerProfile, ClubBranch, intent-onboarding, claim |

**Разделение:** TECH_SPEC — _как устроен код_; PRODUCT — _что видит пользователь_; ACCOUNT_MODEL — _сущности и onboarding_.

Cursor automation: `.cursor/rules/`, `.cursor/skills/`, slash-команды `/hooks`, `/logging`, `/diagnosis`, `/tests` и `/import-instagram-trainers` (см. TECH_SPEC §13). Журнал действий — [TECH_SPEC §4.8](./TECH_SPEC.md#48-журнал-действий).

## Стек и команды

| Слой      | Технология                                                  |
| --------- | ----------------------------------------------------------- |
| Framework | TanStack Start + TanStack Router (file-based routes)        |
| UI        | React 19, Tailwind CSS v4, shadcn/ui (`src/components/ui/`) |
| SSR       | `src/server.ts`, `src/start.ts`                             |

```bash
nvm use 22          # TanStack Start требует Node >= 22.12
npm install
npm run db:up       # PostgreSQL в Docker (порт 5433)
cp .env.example .env
npm run db:push     # применить схему
npm run db:seed     # admin@trenio.by / super@trenio.by
npm run settlements:import  # public/data/belarus-settlements.json (GeoNames BY)
npm run dev          # http://trenio.local (Apache проксирует на порт 8080)
npm run geoip:update # база GeoLite2 для города в фильтре категории
npm run build
npm run preview
npm run lint
npm run test
npm run logs:install
```

Локальный адрес — `http://trenio.local`. В `/etc/hosts` строка `127.0.0.9 trenio.local`. Apache (`trenio.local.conf`) проксирует этот хост на Vite `127.0.0.1:8080`, включая WebSocket для HMR.

## Auth и роли

| Роль         | Назначение                                    |
| ------------ | --------------------------------------------- |
| `user`       | Обычный пользователь (ищет тренера)           |
| `trainer`    | Тренер                                        |
| `club`       | Представитель клуба / филиала                 |
| `admin`      | Администратор и модератор                     |
| `superadmin` | Суперадмин (в т.ч. будущий доступ к финансам) |

Публичная регистрация: `user`, `trainer`, `club`. Роли `admin` / `superadmin` — только через seed или назначение staff.

Маршруты auth: `/auth/login` (e-mail, SMS, Telegram), `/auth/signup`, `/auth/forgot-password` (e-mail или SMS), `/auth/reset-password`, `/auth/verify-email`.

Подробнее о доменной модели — [ACCOUNT_MODEL.md](./ACCOUNT_MODEL.md).

## Структура репозитория

```
src/
├── routes/           # Страницы (TanStack file routes)
├── components/       # UI-компоненты (site-chrome, auth-styles, ui/)
├── auth/             # Server auth (service, session, middleware)
├── lib/
│   ├── auth/         # Schemas, server fns, client hooks
│   └── geo/          # Nominatim, кеш адреса, server fns подсказок. См. TECH_SPEC §4.7
├── db/               # Drizzle schema, seed
├── hooks/
├── styles.css
├── router.tsx
├── server.ts
└── start.ts

public/               # Статика (WebP для UI; PWA icons/manifest — planned)
assets/               # Исходники медиа (images, portraits)
docs/                 # Документация
.cursor/              # Rules, skills, hooks
AGENTS.md             # Entry point для агентов
```

`src/routeTree.gen.ts` генерируется автоматически — не редактировать вручную.
Не создавать `src/pages/` или Next.js-style `app/` — маршруты только в `src/routes/`.

## Реализованные маршруты (frontend)

| URL                     | Файл                       | Назначение                                                    |
| ----------------------- | -------------------------- | ------------------------------------------------------------- |
| `/`                     | `index.tsx`                | Главная, поиск, категории первого уровня, витрина направлений |
| `/search`               | `search.tsx`               | Результаты поиска: карта и карточки, как `/map`               |
| `/map`                  | `map.tsx`                  | Карта мест тренировок. Метки текущего кадра: при большом числе точек — группы, список рядом подгружается страницами. Без точки IP кадр — Минск. `?sports=` и `?city=` не индексируются. `?city=` приходит со страницы города и оставляет только его места |
| `/categories`                     | `categories.index.tsx`               | Каталог всех спортивных категорий                             |
| `/categories/$slug`                 | `categories.$slug.tsx`               | Родительская спортивная категория                             |
| `/categories/$parentSlug/$childSlug` | `categories.$parentSlug.$childSlug.tsx` | Конкретный вид спорта внутри категории                        |
| `/category/*`                       | `category.*.tsx`                     | Редирект на `/categories/*` (legacy)                          |
| `/city/$slug`           | `city.$slug.index.tsx`     | Каталог тренеров города. Город страницы уже выбран. В сайдбаре фильтр спорта: оба уровня таксономии, поиск и мультиселект. 20 крупнейших городов: minsk, gomel, grodno, vitebsk, mogilev, brest, bobruisk, baranovichi, borisov, pinsk, mozyr, lida, orsha, soligorsk, novopolotsk, molodechno, polotsk, zhlobin, rechitsa, zhodino |
| `/city/$slug/$sport`    | `city.$slug.$sport.index.tsx` | Страница «Найти тренера по {спорту} в {городе}». Один вид спорта или категория. Пример: `/city/brest/boks` |
| `/city/$slug/$sport/$child` | `city.$slug.$sport.$child.tsx` | Тот же каталог, если slug вида спорта совпадает с категорией: `/city/minsk/yoga/yoga`. Остальные вложенные адреса переходят на короткий |
| `/sitemap.xml`          | `sitemap[.]xml.ts`         | Карта страниц каталога, городов и связок спорт + город |
| `/robots.txt`           | `robots[.]txt.ts`          | Разрешает обход и указывает sitemap |
| `/404`                  | `404.tsx`                  | Фирменная страница «страница не найдена». Тот же экран у любого неизвестного адреса. Не индексируется |
| `/403`                  | `403.tsx`                  | Фирменная страница «нет доступа». Тот же экран, если сервер закрыл страницу. Не индексируется |
| `/trainers/$slug`       | `trainers.$slug.tsx`       | Профиль тренера. Фото листаются, миниатюры едут вместе. Карандаш редактирования — в правом верхнем углу текста. У отзыва аватар аккаунта, без фото — картинка по имени. Тренер не пишет отзыв себе. «Ответить» видит только он, затем автор отзыва, по очереди. До трёх мест в Беларуси списком. Строка с координатами переключает карту OpenStreetMap в профиле |
| `/trainers/claim/$token` | `trainers.claim.$token.tsx` | Привязка импортированной карточки: оферта, логин и пароль. После публикации или привязки тот же адрес открывает публичный профиль |
| `/favorites`            | `favorites.tsx`            | Редирект на `/account/favorites`                              |
| `/account`              | `account.tsx`              | Оболочка кабинета. `/account` открывает отзывы                |
| `/account/reviews`      | `account.reviews.tsx`      | Свои отзывы и статус                                          |
| `/account/messages`     | `account.messages.tsx`     | Сообщения клиента тренерам. Роли trainer и club переходят в `/me/messages` |
| `/account/messages/$conversationId` | `account.messages.$conversationId.tsx` | Тред. На широком экране список слева, на узком — сверху |
| `/account/bookings`     | `account.bookings.tsx`     | Записи на тренировки, раздел в разработке                     |
| `/account/favorites`    | `account.favorites.tsx`    | Избранные тренеры карточками. Сердечко в шапке ведёт сюда     |
| `/account/settings`     | `account.settings.tsx`     | Имя и фамилия — оба обязательны, аватар, пароль. Почта и телефон закрыты, пока не нажато «Редактировать»; подтверждение кодом. Сообщения в окне |
| `/clubs`                | `clubs.index.tsx`          | Каталог клубов                                                |
| `/clubs/$slug`          | `clubs.$slug.tsx`          | Профиль клуба / филиала                                       |
| `/blog/$slug`           | `blog.$slug.tsx`           | Статья блога                                                  |
| `/auth/login`           | `auth.login.tsx`           | Вход: e-mail, SMS, Telegram                                   |
| `/auth/signup`          | `auth.signup.tsx`          | Регистрация                                                   |
| `/auth/forgot-password` | `auth.forgot-password.tsx` | Сброс пароля по e-mail или SMS                                |
| `/auth/reset-password`  | `auth.reset-password.tsx`  | Новый пароль по токену                                        |
| `/auth/verify-email`    | `auth.verify-email.tsx`    | Подтверждение e-mail                                          |
| `/admin`                | `admin.tsx`, `admin.index.tsx` | Оболочка кабинета администратора и обзор |
| `/admin/trainers`       | `admin.trainers.index.tsx` | Таблица тренеров: имя целиком, телефон, категория, «С кем», рейтинг звездой, значение и число отзывов в скобках, аккаунт, Instagram и Telegram если указаны. Поиск по всем полям. Иконка открывает публичный профиль, иконка карандаша — редактирование |
| `/admin/trainers/$slug` | `admin.trainers.$slug.tsx` | Карточка тренера: поля, до 9 фото, город Беларуси, входы, логи и данные. У каждого места бейдж геокодирования и кнопка «Перегеокодировать» |
| `/admin/reviews`        | `admin.reviews.tsx`        | Модерация отзывов: фильтр по статусу, категории и виду спорта, сортировка. Имя отправителя открывает клиента. Списки кабинетов — по 50 записей |
| `/admin/messages`       | `admin.messages.tsx`       | Жалобы на сообщения: фильтр по статусу, тред только для чтения, отклонить / закрыть / заблокировать пару |
| `/admin/accounts`       | `admin.accounts.index.tsx` | Подтверждённые аккаунты; поиск, фильтр по роли и статусу, пагинация |
| `/admin/accounts/$id`   | `admin.accounts.$id.tsx`   | Профиль аккаунта, вкладки «Входы» и «Логи». Обычный администратор не открывает суперадмина |
| `/admin/finance`        | `admin.finance.tsx`        | Бухгалтерия, раздел в разработке |
| `/admin/settings`       | `admin.settings.tsx`       | Настройки аккаунта администратора |
| `/me`                   | `me.tsx`, `me.index.tsx`   | Личный кабинет тренера и клуба: обзор. Та же сетка, что у `/account` |
| `/me/messages`          | `me.messages.tsx`          | Диалоги профиля и диалоги, которые тренер сам начал |
| `/me/messages/$conversationId` | `me.messages.$conversationId.tsx` | Тред кабинета тренера |
| `/me/reviews`           | `me.reviews.tsx`           | Отзывы о профиле тренера |
| `/me/favorites`         | `me.favorites.tsx`         | Избранные карточки |
| `/me/profile`           | `me.profile.tsx`           | Публичная карточка. Имя и фамилия здесь не редактируются |
| `/me/settings`          | `me.settings.tsx`          | Имя, фамилия и телефон аккаунта |
| `/trainer-admin`        | `trainer-admin.tsx`        | Старый адрес кабинета: перенаправляет на `/me`, `?tab=settings` на `/me/settings`, `?tab=card` на `/me/profile`, `?tab=reviews` на `/me/reviews` |
| `/privacy`              | `privacy.tsx`              | Политика конфиденциальности                                   |
| `/join/trainer`         | `join.trainer.tsx`         | «Привет!». Instagram, Telegram и телефон РБ. Ссылка «У меня нет Instagram» открывает Telegram и телефон. Сюда ведут «Стать тренером», «Добавить профиль» и пустой каталог |
| `/offer`                | `offer.tsx`                | Договор оферты для размещения профиля тренера                 |

Полная целевая карта URL (включая backend и SEO-страницы каталога) — в [PRODUCT.md §3](./PRODUCT.md#3-маршруты-и-страницы).

## Обновление документации

При добавлении маршрута или изменении продукта:

1. Обновить route-файл в `src/routes/`
2. Синхронизировать таблицу «Реализованные маршруты» в этом файле
3. При изменении доменной модели или auth-flow — обновить [ACCOUNT_MODEL.md](./ACCOUNT_MODEL.md)
4. При изменении таксономии, SEO или UX-правил — обновить [PRODUCT.md](./PRODUCT.md)
