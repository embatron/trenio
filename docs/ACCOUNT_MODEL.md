# Trenio.by — модель аккаунтов и сущностей

Trainer-centric модель для платформы «я ищу тренера».

> Продуктовый контекст, MVP, SEO и UX-профилей — в [PRODUCT.md](./PRODUCT.md).

## 1. Базовое решение

| Сущность | Роль |
| --- | --- |
| `Account` | Одна учётная запись, общий auth-flow |
| `TrainerProfile` | Главная сущность каталога тренеров |
| `ClubBranch` | Главная клубная сущность (конкретная точка, не абстрактный «клуб») |
| `Brand` | Сеть / франшиза над филиалами |
| `TrainerBranchLink` | Связь тренера с филиалом |
| `ClaimRequest` | Заявка на получение контроля над сущностью |

**Ключевые принципы:**

- тренерская карточка живёт самостоятельно;
- филиал — единица каталога для клубов (адрес, SEO, тренеры, контакты);
- бренд объединяет филиалы, но не заменяет их;
- регистрация одна, сценарий определяется через `intent`.

**Формула:**

```
Account → intent → onboarding
Brand → ClubBranch
TrainerProfile ↔ TrainerBranchLink ↔ ClubBranch
```

## 2. Что упрощено

Не считаем обязательными для ядра:

- клубные роли `owner/admin/manager`;
- модель «клуб владеет тренером»;
- отдельные регистрации под каждую роль.

Система хранит **права доступа**, а не внутреннюю оргструктуру клуба.

## 3. Сущности

### Account (реализовано в PostgreSQL)

Таблица `users` + `user_roles` — см. [TECH_SPEC.md §4](./TECH_SPEC.md#4-backend-и-база-данных).

- `id`, `email`, `phone`, `password_hash`, `first_name`, `last_name`
- `status`: `pending_verification` | `active` | `suspended` | `deleted`
- `last_signup_intent` — onboarding intent после регистрации
- Сессии: HttpOnly cookie, таблица `sessions`

**Platform roles** (RBAC, таблица `user_roles`):

| Роль | Назначение |
| --- | --- |
| `user` | Ищет тренера (публичная регистрация) |
| `trainer` | Тренер (публичная регистрация) |
| `club` | Представитель клуба (публичная регистрация) |
| `admin` | Модератор / админ (только staff) |
| `superadmin` | Полный доступ (+ финансы в будущем) |

Intent при регистрации (`last_signup_intent`) и platform role связаны, но не тождественны: intent ведёт в onboarding, role — в RBAC.

Один человек может через один аккаунт управлять тренером, филиалом или брендом.

### TrainerProfile

- `id`, `slug`, `full_name`, `city`, `bio`, `sports`, `contacts`
- `status`: `draft` | `published` | `hidden` | `archived`
- `claim_status`: `unclaimed` | `claimed` | `disputed`
- `created_source`: `self` | `branch_created` | `admin_created` | `import`
- `owner_account_id` (nullable)

**Правила:** профиль может существовать без владельца; профиль, созданный филиалом — `unclaimed` до claim.

### TrainerReview

Таблица `trainer_reviews`. Один отзыв на аккаунт и slug опубликованного тренера.

- `trainer_slug`, `user_id`, `author_name`, `rating` (1–5), `body`
- `status`: `pending` (на модерации), `published` (на странице тренера и в рейтинге), `rejected` (отклонено)
- `moderation_note` — комментарий сотрудника, виден автору при статусе `rejected`
- Новый отзыв создаётся как `pending`. Текст — ограниченный HTML (жирный, курсив, списки). Уже существующие строки остаются `published`. В оценку и публичный список попадают только `published`.
- Пишет только вошедший пользователь. Повторная отправка того же аккаунта не создаёт второй отзыв.
- Гость с кнопки «Сделать первый отзыв» / «Добавить отзыв» уходит на вход и возвращается на профиль.
- При новом отзыве письмо уходит всем активным `admin` и `superadmin`. Публикация и отклонение пишут автору. Без `RESEND_API_KEY` письмо пишется в лог сервера.
- Свой статус пользователь видит в `/account/reviews`. Плашка «Отклонено» открывает комментарий сотрудника. Сотрудник разбирает очередь в таблице `/admin/reviews`.

### UserFavorite

Таблица `user_favorites`. Запись живёт, пока пользователь сам её не снимет или пока не удалён аккаунт: срок сессии на неё не влияет. Сердечко на карточке тренера или клуба сохраняется только у вошедшего пользователя. Список и переключение уходят отдельными запросами после отрисовки страницы и не ждут полной перезагрузки. Повторное нажатие снимает запись. Гость с сердечка уходит на вход. Число избранного показано в правой части шапки и не видно без сессии. Сердечко в шапке открывает `/account/favorites`, где тренеры стоят карточками. Старый адрес `/favorites` перенаправляет туда. Гость с этого адреса уходит на вход.

### Brand

- `id`, `name`, `slug`, `description`, `contacts`, `status`, timestamps
- Не заменяет филиал; верхний уровень для сетей (например, «Адреналин», «X-Fight»)

### ClubBranch

- `id`, `brand_id` (nullable), `name`, `slug`, `city`, `district`, `address`, `description`, `contacts`, `status`, timestamps

Даже у одиночного клуба: один `Brand` + один или несколько `ClubBranch`.

### TrainerBranchLink

- `trainer_profile_id`, `club_branch_id`
- `status`: `pending` | `active` | `archived` | `rejected`
- `source`: `trainer_added` | `branch_added` | `admin_added`
- `is_primary`

### ClaimRequest

- `entity_type`: `trainer_profile` | `brand` | `club_branch`
- `entity_id`, `account_id`
- `status`: `pending` | `approved` | `rejected` | `expired`
- `verification_method`

## 4. Иерархия

```
Brand
└── ClubBranch
    └── TrainerBranchLink
        └── TrainerProfile
```

## 5. Антипаттерны

| Не делать | Почему | Вместо этого |
| --- | --- | --- |
| Отдельные auth-регистрации по ролям | Ломает конверсию и multi-entity сценарии | Один auth-flow + intent |
| Отдельный аккаунт тренера от имени филиала | Дубли, конфликт ownership | Поиск existing trainer → `unclaimed` profile → claim |
| Плоская сущность «Club» | Ломает филиалы, local SEO, сети | `Brand` + `ClubBranch` |

## 6. Регистрация и onboarding

### Общий auth-flow

Вход: e-mail и пароль, SMS-код на подтверждённый мобильный номер РБ, либо уже привязанный Telegram (виджет или Mini App). Сброс пароля — ссылка на e-mail или SMS-код и новый пароль. Подтверждение e-mail остаётся отдельным шагом регистрации. Длинные формы профиля — после входа.

### Intent

Фиксируется до или в момент регистрации:

| Intent | Результат onboarding |
| --- | --- |
| `trainer_create` | Создание `TrainerProfile` |
| `branch_create` | Создание `ClubBranch` |
| `brand_create` | Создание `Brand` |
| `trainer_claim` | Claim существующего профиля |
| `client_signup` | Клиентский сценарий (не определяет core model) |

## 7. Product flows

### Тренер создаёт себя

`Я тренер` → auth → `intent=trainer_create` → onboarding → `TrainerProfile` → привязка к филиалам.

### Филиал регистрируется

`Добавить филиал` → auth → `intent=branch_create` → onboarding → `ClubBranch` → привязка к `Brand`.

### Сеть / бренд

`Добавить сеть` → auth → `intent=brand_create` → `Brand` → добавление филиалов. Можно не выводить в MVP UI.

### Филиал добавляет тренера

1. Поиск совпадений среди existing trainers.
2. Найден → `TrainerBranchLink` (запрос или создание).
3. Не найден → `TrainerProfile` (`unclaimed`) → ссылка на claim.

### Тренер claim'ит профиль

`Это мой профиль` → auth → `intent=trainer_claim` → `ClaimRequest` → после подтверждения `owner_account_id`.

## 8. Права доступа

Вместо клубных ролей — минимальная модель:

- `editor`
- `primary_editor`
- `platform_admin`

Применяется к `TrainerProfile`, `ClubBranch`, `Brand`.

## 9. Контакты и ownership

| Сущность | Правило |
| --- | --- |
| `TrainerProfile` | После claim контакты контролирует тренер. До claim — контакты филиала, CTA «запись через филиал» или скрыты личные контакты |
| `ClubBranch` | Контакты принадлежат филиалу |
| `Brand` | Отдельно от контактов филиалов |

## 10. Личные кабинеты

| Кабинет | Возможности |
| --- | --- |
| Тренер | `/trainer-admin`: та же оболочка. «Параметры» — общие поля аккаунта. «Профиль тренера» — карточка: имя, заголовок, текст, не больше четырёх видов спорта, город Беларуси, цена и стаж целыми числами, языки, контакты, Instagram, Telegram и фото |
| Администратор | Оболочка `/admin`. Разделы — отдельные страницы: `/admin` обзор, `/admin/trainers` таблица (имя открывает карточку в новой вкладке; «не привязан» значит, что у карточки нет пользователя), `/admin/trainers/$slug` поля профиля, входы, логи и прочие данные, `/admin/reviews` модерация, `/admin/accounts`, `/admin/finance` (в разработке), `/admin/settings`. Обычный администратор не видит аккаунты и отзывы суперадмина |
| Филиал | CRUD `ClubBranch`, привязка к бренду, поиск тренеров, `unclaimed` profiles, `TrainerBranchLink` |
| Бренд | CRUD `Brand`, список филиалов, добавление / подтверждение филиалов |
| Клиент | `/account/reviews`, `/account/bookings`, `/account/favorites`, `/account/settings`. Отзывы и статус, записи (в разработке), избранное карточками. В параметрах одно поле «Имя и фамилия», аватар, пароль. Почта и телефон закрыты, пока не нажата ссылка «Редактировать», затем их подтверждают кодом. Сообщения об успехе и ошибке открываются в окне. Роль и статус аккаунта только для просмотра |

## 11. Продуктовый стандарт

- `TrainerProfile` — главная сущность каталога тренеров
- `ClubBranch` — главная сущность каталога клубов
- `Brand` — верхний уровень для сетей
- регистрация общая, onboarding по `intent`
- филиал не создаёт тренеру личный аккаунт
- филиал сначала ищет existing trainer, иначе — только `unclaimed TrainerProfile`
- claim-flow обязателен
