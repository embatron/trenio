# Оболочки Trenio.by для iOS и Android

Запись о том, что уже лежит в репозитории после сборки мобильных оболочек. Это не заявка в сторы и не инструкция по выпуску. Боевой сайт, кабинет и каталог остаются одним процессом Nitro и одной PostgreSQL. Отдельной базы, очереди и API-сервиса нет.

Дата описания: 12 ноября 2026.

Коротко: Android — Trusted Web Activity вокруг `https://trenio.by`. Gradle-проект лежит в `mobile/android` и собран шаблоном Bubblewrap 1.27 (`androidbrowserhelper` 2.7.4). iOS — Capacitor 8, WKWebView на тот же адрес, проект в `mobile/ios`. Keystore, ключей Apple и установленного приложения в репозитории нет. На этом Mac нет полного Xcode, нет JDK и нет Android SDK, поэтому симулятор и APK отсюда не собираются. Скрипт сборки в этом случае пишет, чего не хватает, и выходит с кодом 0.

## Что видит человек

| Где | Что открывается | Вход Google | Вход Apple |
| --- | --- | --- | --- |
| Браузер, `http://trenio.local` или `https://trenio.by` | Обычный сайт | Кнопка «Войти через Google», адрес `/auth/google` | Кнопки нет |
| Android TWA | Тот же сайт в Chrome на весь экран | Та же кнопка, внутри Chrome | Кнопки нет |
| iOS-оболочка | Тот же сайт в WKWebView | Та же кнопка, но ссылка уходит в системный браузер | Кнопка «Войти с Apple» |

Отдельной кнопки «Gmail» нет. Почта Gmail входит через Google. Этот вход уже был на сайте до оболочек. В нативный проект его не копировали вторым экраном: оболочка грузит сайт. Google не принимает вход внутри окна приложения, поэтому в iOS-оболочке клик по «Войти через Google» и «Войти через Яндекс» открывает системный браузер (`@capacitor/browser`). Если плагин не загрузился, остаётся обычный переход по ссылке.

Кнопка Apple рисуется только когда страница понимает, что она внутри iOS-оболочки: у `window.Capacitor` платформа `ios`, либо в User-Agent есть `Trenio-iOS/` и цифра версии. Сайт дописывает к обычному Safari-агенту `Trenio-iOS/1.0`, а не подменяет его целиком, чтобы не сломать Яндекс.Карты.

## Экран внутри оболочки

Класс `app-native` ставится на `html`, когда это iOS-оболочка или первый заход Android TWA с referrer `android-app://by.trenio.app`. Дальше Android помнит это до закрытия вкладки. Браузер и установленное PWA класс не получают: шапка, подвал и ссылки в новой вкладке у них прежние.

В оболочке шапка и подвал скрыты. Внизу панель разделов цветом `var(--primary)`, не отдельным коралловым. У клиента это поиск, избранное, сообщения и профиль. У тренера и клуба к поиску добавляются страница, сообщения, статистика и профиль: без поиска каталог из оболочки не открыть. У сотрудника панель ведёт в каталог, `/admin/messages` и `/admin`. На активном пункте повторное нажатие прокручивает страницу вверх. Число на сообщениях — тот же непрочитанный итог, что в шапке.

Ниже корня панели есть «Назад». На iOS это шеврон и название раздела, на Android — стрелка. Свайп от левого края включён у WKWebView. Системная кнопка Android в TWA — это назад Chrome: с первого экрана она сворачивает приложение, отдельного слушателя Capacitor там нет.

Ссылка с `target="_blank"` на этот же сайт открывается в том же окне. Instagram, Telegram и другие внешние адреса на iOS уходят в системный браузер. Телефон и почта не перехватываются. Enter в сообщении по-прежнему переносит строку, отправка — Ctrl+Enter или ⌘+Enter.

Жесты удаления, нижние шторки фильтров, щипок фото и вибрация в эту поставку не входили: список сообщений уже задан своими кнопками ответа и меню, а вибрация не должна срабатывать в браузере.

## Граница, которую код не переходит

Пока в окружении сервера пустой `APPLE_CLIENT_ID`, `POST /api/auth/apple` отвечает 404 и в базу не ходит. Пустые `APN_*` не отправляют пуш на iPhone: если у человека уже есть строка в `user_devices`, в журнал пишется пропуск, само сообщение и письмо живут как раньше. Пустой `APPLE_TEAM_ID` отдаёт `apple-app-site-association` с пустым списком ссылок. Пустой `ANDROID_SHA256_FINGERPRINTS` отдаёт `assetlinks.json` с пакетом `by.trenio.app` и пустым списком отпечатков.

Web Push сайта не переписывался. Браузер, установленное PWA и Android TWA получают уведомление через VAPID и `public/sw.js`. Токен APNs в `push_subscriptions` не кладётся: там обязательны `p256dh` и `auth`, это ключи браузера.

Firebase и FCM не подключались.

Секреты в git не входят: `.p8`, `*.keystore`, `mobile/android/signing.properties`.

## Как устроен запрос

```
Браузер / PWA / Mini App     cookie, Origin https://trenio.by или http://trenio.local
Android TWA                  тот же Origin, профиль Chrome, Web Push VAPID
iOS WKWebView                server.url = https://trenio.by, та же cookie
        │
        ▼
nginx или Apache → Nitro, src/server.ts
        │
        ▼
src/start.ts
  mobileApiMiddleware     четыре новых адреса и два файла .well-known
  telegram webhook        как было
  ошибка 500              как было
        │
        ▼
страницы src/routes, server functions, сокет /messages/live
        │
        ▼
PostgreSQL
  users.apple_sub, users.apple_email
  push_subscriptions          только VAPID, колонки platform и token_type
  user_devices                только APNs
```

Сокет `/messages/live` по-прежнему принимает только `http` и `https` и хост этого сайта (`trenio.by`, `www.trenio.by`, `trenio.local`, плюс localhost вне production). Схема `capacitor://localhost` отклоняется. При `server.url` на боевой сайт документ и так живёт на `https://trenio.by`, отдельный origin оболочке не нужен.

Чтение cookie сессии для сокета и для новых API вынесено в `src/lib/http/request-cookie.ts`.

## База

Колонки и таблица ставятся при старте процесса, тем же приёмом, что Google и пуш. `db:push` для этого не используется. Повторно то же самое делает `npm run apple:install` (`scripts/apply-apple-login.ts`).

`ensureAuthSchema` в `src/auth/auth-schema.ts`:

- `users.apple_sub varchar(255)`, уникальный индекс `users_apple_sub_unique`
- `users.apple_email varchar(320)`
- прежняя проставка `password_set_at` не трогает строку, у которой уже есть `apple_sub`

`ensurePushSchema` в `src/lib/messages/push-schema.ts`:

- `push_subscriptions.platform text NOT NULL DEFAULT 'web'`
- `push_subscriptions.token_type text NOT NULL DEFAULT 'vapid'`
- индекс `push_subscriptions_user_platform_idx` по `(user_id, platform)`
- таблица `user_devices`

```sql
CREATE TABLE IF NOT EXISTS user_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform text NOT NULL,
  push_token text NOT NULL,
  token_type text NOT NULL,
  device_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, push_token)
);
```

Drizzle-описание: `src/db/schema/users.ts`, `src/db/schema/push-subscriptions.ts`, `src/db/schema/user-devices.ts`. Экспорт таблицы устройств добавлен в `src/db/schema/index.ts`.

Смысл колонок:

- `apple_sub` — устойчивый идентификатор Apple, как `google_sub` и `yandex_sub`.
- `apple_email` — адрес, который Apple прислал в первый раз, включая скрытый `privaterelay.appleid.com`.
- `platform` и `token_type` на старых браузерных подписках остаются `web` и `vapid`.
- Одна установка iPhone — одна строка `user_devices`. Повторная регистрация того же токена обновляет строку. Вход другого аккаунта на том же телефоне забирает токен у прежнего пользователя. iPhone и iPad одного человека не стирают друг друга. Снимается только предыдущий токен этой установки, если клиент прислал `replacedToken`.

`needsPassword` в `src/auth/service.ts` гаснет и при `appleSub`, как уже гаснет при Google и Яндексе. Человек, вошедший через Apple, не попадает на стену «задайте пароль» только из-за случайного хеша.

## Вход через Apple

Кнопка: `src/components/auth/apple-login-button.tsx`. Знак: `AppleIcon` в `src/components/brand-icons.tsx`. Кнопка стоит на `/auth/login`, `/auth/signup` и в окне короткой ссылки тренера (`src/components/trainer-door-editor.tsx`). На регистрации она подчиняется тому же флажку политики, что Google и Яндекс. Пока оболочка не определилась, кнопка не рисуется, чтобы сервер и браузер не разошлись при гидрации.

Нажатие вызывает плагин `@capacitor-community/apple-sign-in`:

- `clientId`: `by.trenio.app`
- `redirectURI`: текущий origin плюс `/auth/login`
- области: `email name`

Имя и почта приходят от Apple только в первый раз. Дальше человек находится по `sub`.

Плагин возвращает `identityToken`. Клиент шлёт `POST /api/auth/apple`:

```json
{
  "identityToken": "...",
  "returnPath": "/trainers/slug",
  "browse": false,
  "user": { "email": "...", "firstName": "...", "lastName": "..." }
}
```

`authorizationCode` на сервер можно прислать, он не читается и в базу не пишется.

Обработчик — `handleMobileApi` в `src/lib/mobile/http.ts`, его вызывает `mobileApiMiddleware` в `src/start.ts` раньше остальных страниц.

Порядок:

1. Нет `APPLE_CLIENT_ID` — 404, без лимита и без базы.
2. Лимит `apple:{ip}` тот же, что у входа: 12 попыток за 15 минут на `X-Real-IP`. Сверх лимита — 429 и журнал `auth.login.apple` / `denied`.
3. JWT проверяет `verifyAppleIdentity` (`src/lib/mobile/apple-token.ts`) через `jose` и ключи `https://appleid.apple.com/auth/keys`. Издатель — `https://appleid.apple.com`. Аудитория — значение `APPLE_CLIENT_ID`, для нативного входа это bundle id `by.trenio.app`, не связка team id и bundle. Срок и `sub` длиной от 8 до 255 символов проверяет `appleClaimsOk`. Плохой токен — 401. Сам токен в журнал не пишется.
4. `openAppleAccount` в `src/auth/apple-account.ts` решает судьбу строки тем же `decideAppleLink`, что Google и Яндекс через `decideMailboxLink`:
   - строки нет — создать;
   - аккаунт заблокирован или удалён — отказать;
   - почта ещё не подтверждена — занять строку: новый случайный scrypt-хеш, сессии сбрасываются, `apple_sub` записывается, почта помечается подтверждённой;
   - почта подтверждена и `apple_sub` пуст или тот же — прикрепить;
   - у строки уже чужой `apple_sub` — отказать.
5. Отказ — 403 и `reason`: `deleted`, `blocked`, `taken` или `invalid`.
6. Успех — сессия через `beginLogin`. Сотрудник с TOTP получает куку `trenio_totp` и `redirectTo: /auth/totp`. Остальные получают куку `trenio_session` (HttpOnly, 3 недели, SameSite=Lax, Secure в production) и адрес из `destinationAfterAuth`.
7. Журнал `auth.login.apple`. В `subject` почта, если это не `pending.…@users.trenio.invalid`.

Новая строка:

- id задаётся заранее;
- если Apple прислал адрес и это не служебный домен `users.trenio.invalid` или `nick.trenio.by`, он становится `users.email`, почта сразу подтверждена, статус `active`, роль `user`, намерение `client_signup`;
- если адреса нет, почта — `pending.{id}@users.trenio.invalid`, `email_verified_at` пуст;
- пароль — случайные 32 байта через scrypt, `password_set_at` пуст;
- имя берётся через `storedGivenName`, пустое имя не подменяется куском служебного адреса;
- после входа имена дописываются тем же `rememberOAuthNames`, что у Google и Яндекса: уже выбранное имя не затирается;
- если адрес настоящий и совпадает с почтой аккаунта, на карточку тренера этого владельца ставится подтверждение почты, как у Яндекса.

Повторная гонка уникального индекса перечитывает строку по `apple_sub` или по почте и проходит те же правила ещё раз.

## Устройства и пуш

Регистрация: `POST /api/push/register`. Нужна сессия. Тело принимает только `parseDeviceRegister`:

- `platform` строго `ios`
- `tokenType` строго `apns`
- `token` — 32–512 символов из латиницы, цифр, `_` и `-`
- `replacedToken` по тому же правилу, либо пусто
- `deviceName` обрезается до 80 символов

Android, FCM и короткий токен — 400. Без сессии — 401, до базы. Лимит — 30 записей за 15 минут на пользователя. Чужой токен этого же устройства удаляется, затем строка вставляется или обновляется по паре `(user_id, push_token)`. Журнал `auth.device`, в контексте только платформа и тип, не сам токен.

Снятие: `POST /api/device/unregister`, тело `{ "token": "..." }`, та же проверка токена и сессии. Клиент вызывает это из `logoutWithShell` до того, как сервер сотрёт сессию. Выход в шапке, в кабинетах пользователя, тренера, клуба, администратора, в окне обязательной почты и на `/auth/totp` идёт через эту обёртку. В браузере обёртка ничего не шлёт.

Список: `GET /api/device/info`. Своя сессия. В ответе платформа, тип, имя, время и последние 4 символа токена. Целиком токен не отдаётся.

Отправка. `sendMessagePushes` в `src/lib/messages/push.ts` сначала делает прежний цикл VAPID. Отсутствие ключей VAPID по-прежнему пишет пропуск и не обрывает функцию. Затем `sendApnsPushes` в `src/lib/mobile/apns.ts`:

- нет строк APNs — тишина;
- строки есть, а `APN_KEY_PATH`, `APN_KEY_ID` или `APN_TEAM_ID` пусты — `message.push` / `skipped`, канал `apns`;
- провайдер `apn` один на процесс, production-флаг равен `NODE_ENV === "production"`;
- тема уведомления `by.trenio.app`;
- заголовок и текст те же, что уже уходят в браузер, в payload только `url`;
- `BadDeviceToken`, `Unregistered` и статус 410 удаляют строку устройства;
- сбой ключа или сети пишет `message.push` / `failure` и не откатывает само сообщение.

Пакет `apn` вынесен из клиентской сборки в `vite.config.ts` (`ssr.external`, `nitro.externals`, `optimizeDeps.exclude`). Рядом так же исключён `jose`.

Клиент после входа в оболочке (`bootNativeShell` в `src/lib/native/shell.ts`, вызов из `src/routes/__root.tsx`):

- статус-бар: светлый текст, фон `#f04b50`;
- splash скрывается;
- клавиатура в режиме `native`, чтобы поле сообщения поднималось;
- если есть пользователь, запрашивается разрешение на пуш, слушатель `registration` шлёт токен на `/api/push/register`, предыдущий токен этой установки лежит в `localStorage` под ключом `trenio-apns-token`.

В браузере `bootNativeShell` сразу выходит.

## Камера и карта

Скрепка в переписке по-прежнему открывает `<input type="file">`, чтобы PDF не пропал. В оболочке перед этим `prepareShellCamera` один раз просит права камеры и фототеки через `@capacitor/camera`. Отказ плагина не мешает системному выбору файла.

Кнопка «моё место» на `/map` в оболочке сначала берёт точку у `@capacitor/geolocation`. Вне оболочки остаётся `navigator.geolocation`. Точка вне Беларуси по-прежнему не становится центром карты, в журнал клиента уходит прежнее предупреждение `map.locate`.

## Ссылки, offline и файлы сторов

`GET /open?path=` — маршрут `src/routes/open.tsx`. `safeOpenPath` оставляет только относительный путь этого сайта:

- должен начинаться с `/`;
- не длиннее 512 символов;
- `//`, обратный слэш, `://` и их percent-encoding отбрасываются;
- чужой origin становится `/`.

`/open?path=/auth/login` отвечает 307 на `/auth/login`. `https://evil.example` отвечает 307 на `/`. Для возврата после Apple используется `optionalOpenPath`: мусор не подменяет кабинет адресом `/`.

`public/offline.html` — русская страница «Нет сети» и ссылка «Повторить». Фон `#fff5f5`, ссылка `#f04b50`, отступ снизу учитывает `safe-area-inset-bottom`. Ширины макета в этом файле нет: это аварийный документ вне CSS сайта.

`public/sw.js` по-прежнему показывает пуш и не кэширует успешные страницы. На `install` в кэш `trenio-offline-v1` кладётся только `/offline.html`. `fetch` перехватывает лишь `GET` с `mode === navigate`. Сеть ответила — её ответ и уходит. Сеть упала — из кэша берётся offline-страница, иначе короткий текст «Нет сети» со статусом 503. POST, вложения и сокет этот обработчик не трогает.

Копия короткой заглушки для `webDir` Capacitor: `mobile/www/index.html`. Сборка Vite по-прежнему собирает сервер Nitro, а не статику для магазина. `npm run build` оболочку не обновляет.

Файлы ассоциации отдаёт тот же `handleMobileApi`, не статика из `public/`:

- `GET /.well-known/assetlinks.json`, `Content-Type: application/json`. Пакет `by.trenio.app`, отношение `delegate_permission/common.handle_all_urls`. Отпечатки из `ANDROID_SHA256_FINGERPRINTS`: колоночная форма SHA-256 или 64 hex-символа, мусор выбрасывается, hex приводится к колонкам.
- `GET /.well-known/apple-app-site-association` без расширения, тот же тип. Team ID должен быть 10 символов `A–Z` и `0–9`. Тогда `appID` равен `{TEAMID}.by.trenio.app`, путь `*`. Иначе список `details` пуст.

## Проект iOS

Каталог `mobile/ios` создан командой `npx cap add ios`. Bundle id `by.trenio.app`. Конфиг — `capacitor.config.ts`.

Плагины, которые Capacitor записал в проект:

| Пакет | Версия в package.json |
| --- | --- |
| `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios` | ^8.6.0 |
| `@capacitor/app` | ^8.1.2 |
| `@capacitor/browser` | ^8.0.5 |
| `@capacitor/camera` | ^8.2.6 |
| `@capacitor/geolocation` | ^8.2.4 |
| `@capacitor/keyboard` | ^8.0.6 |
| `@capacitor/push-notifications` | ^8.1.3 |
| `@capacitor/splash-screen` | ^8.0.2 |
| `@capacitor/status-bar` | ^8.0.4 |
| `@capacitor-community/apple-sign-in` | ^7.1.0 |
| `@capacitor-community/safe-area` | ^8.0.1 |
| `@capacitor/assets` | ^4.0.0, devDependency |

`cap sync` предупредил, что `apple-sign-in@7.1.0` собран с расчётом на Capacitor 7. Peer dependency у пакета — `@capacitor/core >= 7`. На живом iPhone кнопку ещё нужно прогнать. Понижать весь Capacitor до 7 из-за этого предупреждения не стали.

`Info.plist` (`mobile/ios/App/App/Info.plist`):

- камера: «Камера нужна, чтобы снять фото для сообщения или профиля.»
- фототека: «Фототека нужна, чтобы прикрепить снимок к сообщению или профилю.»
- геолокация при использовании: «Геопозиция нужна, чтобы показать вас на карте тренеров.»
- `UIBackgroundModes`: `remote-notification`
- `WKAppBoundDomains`: `trenio.by`, `www.trenio.by`

`limitsNavigationsToAppBoundDomains` в конфиге включён. Без этих двух доменов WKWebView перестал бы открывать сайт.

`App.entitlements`:

- Sign in with Apple, `Default`
- Associated Domains: `applinks:trenio.by`, `applinks:www.trenio.by`

`PrivacyInfo.xcprivacy` лежит в цели приложения: трекинга нет, из обязательных API объявлен UserDefaults с причиной `CA92.1` (доступ внутри этого же приложения). Подпись Debug и Release указывает `CODE_SIGN_ENTITLEMENTS = App/App.entitlements`. Стиль подписи — Automatic.

`CapacitorHttp` не включался. Для `server.url` на своём домене cookie первого лица. Если на телефоне сессия пропадёт после выгрузки, сначала проверяются app-bound domains, а не прокси всех `fetch`.

Иконка iOS — квадрат 1024: обычный коралловый, тёмный и тонированный. Заставка 2732 — тот же знак по центру поля `#fff5f5`. `npm run mobile:assets` их не собирает.

Клиент слушает `appUrlOpen` (`@capacitor/app`) в `bootNativeShell`. Адрес проходит через `shellAppLink`: только `https`, только `trenio.by` или `www.trenio.by`, дальше тот же разбор, что у `/open`. Чужой адрес страницу не уводит. `SceneDelegate` уже отдаёт ссылку в `SceneDelegateProxy`, так что Capacitor этот listener получает.

## Проект Android

Каталог `mobile/android` — проект Trusted Web Activity, сгенерированный `TwaGenerator` из `@bubblewrap/core` 1.27 по `twa-manifest.json`. Это не Capacitor Android. Сайт внутрь APK не копируется: активность открывает `https://trenio.by/`.

| Файл | Зачем |
| --- | --- |
| `twa-manifest.json` | Пакет `by.trenio.app`, хост, цвета `#F04B50` / `#FFF5F5`, старт `/`, `minSdk` 26 |
| `app/build.gradle` | `compileSdk` 36, `targetSdk` 36, `androidbrowserhelper:2.7.4` |
| `app/signing.gradle` | Подпись release, только если рядом есть `signing.properties` |
| `signing.properties.example` | Образец upload key. Сам `signing.properties` в git не входит |
| `app/src/main/AndroidManifest.xml` | Launcher, Digital Asset Links, `autoVerify` |
| `app/src/main/java/by/trenio/app/` | `Application`, `LauncherActivity`, `DelegationService` |
| `app/src/main/res/` | Adaptive icon, splash и значок уведомления по плотностям |
| `gradlew` | Wrapper Gradle 8.11.1 |
| `store_icon.png` | 512×512 для карточки Play, тот же квадратный знак |

Разрешения: `INTERNET` и `POST_NOTIFICATIONS`. Второе нужно делегированию уведомлений Chrome, не FCM.

App Links с `android:autoVerify="true"` висят на весь хост `trenio.by` и отдельно на `www.trenio.by`. Отдельных `pathPrefix` для `/trainers`, `/city`, `/account` и `/me` нет: эти пути и так входят в хост, а узкий фильтр оставил бы каталог, карту, `/auth` и `/open` в обычном Chrome. Маршрута `/messages` на сайте нет. Сообщения живут на `/account/messages`, `/me/messages` и `/admin/messages`.

Два ключа подписи не смешиваются.

- Upload key — локальный `android.keystore`, alias `trenio`. Им подписывается AAB перед загрузкой в Play. Пароли лежат в `mobile/android/signing.properties` (копия `signing.properties.example`). Keystore и этот файл в git не входят.
- App signing key — ключ, которым Play подписывает то, что ставится на телефон. Его SHA-256 берётся из Play Console после включения Play App Signing и записывается в `ANDROID_SHA256_FINGERPRINTS` на сервере. Отпечаток upload key в `assetlinks.json` приложение не подтвердит.

Пока JDK или Android SDK нет, `npm run mobile:android` проект не собирает и завершается без ошибки. Когда оба стоят, та же команда делает `./gradlew assembleDebug`. `npm run mobile:android:release` делает `bundleRelease` и перед этим требует `signing.properties`.

Повторная генерация через `npx @bubblewrap/cli update` в `mobile/android` перезаписывает шаблонные файлы, включая `app/build.gradle`. Строку `apply from: "signing.gradle"` после этого нужно вернуть. Сам `signing.gradle` шаблоном не затирается.

## Команды

```bash
npm run apple:install          # колонки Apple и user_devices, нужен DATABASE_URL
npm run build:mobile           # debug Android, затем iOS, если стоит Xcode.app
npm run mobile:sync            # npx cap sync ios
npm run mobile:ios             # открыть Xcode
npm run mobile:android         # assembleDebug, если есть JDK и Android SDK
npm run mobile:android:release # bundleRelease, если есть ещё и signing.properties
npm run mobile:assets          # иконки и splash для iOS
npm test                       # node:test, включая правила оболочки
npm run test:load              # 400 запросов, сервер уже должен слушать 8081
npm run test:e2e               # Playwright, среди них e2e/mobile-shell.spec.ts
```

`scripts/build-mobile.sh` вызывает Android-сборку и, только если установлен `/Applications/Xcode.app`, делает `cap sync ios` и `xcodebuild` симулятора без подписи. CI этот архив не подписывает.

Workflow `.github/workflows/mobile.yml` запускается только вручную (`workflow_dispatch`). Android-job на ubuntu вызывает `npm run mobile:android`. iOS-job на macos делает `npm run mobile:sync`. Подписи в Actions нет.

## Окружение

В `.env.example` добавлены пустые значения, кроме bundle id:

```bash
APPLE_CLIENT_ID=by.trenio.app
APPLE_TEAM_ID=
APPLE_KEY_ID=
APPLE_PRIVATE_KEY_PATH=
APN_KEY_PATH=
APN_KEY_ID=
APN_TEAM_ID=
ANDROID_SHA256_FINGERPRINTS=
```

`APPLE_KEY_*` и `APN_*` — разные ключи `.p8`. Боевой `.env` этими переменными пока не заполнен, поэтому локальный сервер на `POST /api/auth/apple` отвечает 404. Это проверено запросом.

## Журнал

Новые действия, оба уже в `.cursor/skills/trenio-logging/reference.md`:

| Действие | Когда |
| --- | --- |
| `auth.login.apple` | Вход Apple: успех, плохой токен, лимит, отказ, сбой |
| `auth.device` | Запись токена, снятие, сбой списка |

Пуш APNs пишет прежний `message.push`. Канал отличает `context.channel = "apns"`. Токен, identity token и код авторизации в журнал не попадают.

## Тесты

Чистые правила, без базы: `src/lib/mobile/shell-rules.test.ts`.

- свой путь `/trainers/demo` и query сохраняются;
- `https://evil.example`, `//evil.example`, обратный слэш и `/%2f%2fevil.example` становятся `/` или `null`;
- принимается только APNs-токен нужной длины;
- отпечаток из 64 hex становится колоночным, мусор отбрасывается;
- team id короче 10 символов не попадает в association;
- аудитория JWT — `by.trenio.app`, не `TEAMID.by.trenio.app`;
- обычный браузер не считается оболочкой, `Trenio-iOS/1.0` и платформа `ios` считаются;
- `decideAppleLink` создаёт, прикрепляет, отказывает чужому sub и заблокированному аккаунту;
- cookie `trenio_session` читается отдельно от соседней.

Нагрузка на эти функции: `src/lib/mobile/load.test.ts`, 20 000 кругов, порог 1 секунда. Прогон уложился примерно в 50 мс.

HTTP без базы: `src/lib/mobile/http.test.ts`. Файлы `.well-known` — JSON. При выключенном `APPLE_CLIENT_ID` вход Apple — 404. Список устройств и регистрация без cookie — 401.

Сокет: `src/lib/messages/socket-origin.test.ts` фиксирует отказ `capacitor://localhost`.

Браузер: `e2e/mobile-shell.spec.ts` на ширине 390. Страница offline видна и не скроллится вбок. `assetlinks.json` содержит `by.trenio.app`. Association отдаётся JSON. `/open?path=/auth/login` открывает вход. На этой странице нет кнопки «Войти с Apple» и есть «Войти через Google». Чужой `path` не уводит на `evil`.

Скрипт `scripts/load-mobile.mjs`: 400 запросов, 20 параллельно, на `PLAYWRIGHT_BASE_URL` или `http://127.0.0.1:8081`. Пути: offline, оба well-known, `/open` на вход и `/open` на чужой адрес. Статус 500 и редирект на `evil` роняют прогон. На уже запущенном локальном сервере p95 был 18 мс.

Полный `npm test` после этих изменений: 288 тестов, 0 падений. Playwright-спека оболочки: 1 прохождение.

Чего тесты не делают: не создают строку Apple в PostgreSQL и не нажимают настоящую кнопку Apple. Решение о связке покрыто функцией `decideAppleLink`, запись в базу — нет.

## Как посмотреть сейчас

Интерфейс входа, включая Google: [http://trenio.local/auth/login](http://trenio.local/auth/login). Это тот экран, который оболочка грузит с сайта. Кнопки Apple в браузере нет, так и задумано.

Проверенные адреса локального сервера:

- `http://127.0.0.1:8081/offline.html` — 200
- `http://127.0.0.1:8081/.well-known/assetlinks.json` — 200, JSON, пакет `by.trenio.app`, отпечатков нет
- `http://127.0.0.1:8081/.well-known/apple-app-site-association` — 200, JSON
- `POST /api/auth/apple` — 404, пока клиент Apple не задан
- `GET /open?path=/auth/login` — 307 на `/auth/login`
- `GET /open?path=https://evil.example` — 307 на `/`

Оболочку как приложение открыть нельзя, пока не установлен Xcode из App Store. Сейчас активны только Command Line Tools (`xcode-select` указывает на `/Library/Developer/CommandLineTools`). После установки Xcode:

```bash
npm run mobile:ios
```

Run в Xcode открывает симулятор. Приложение пойдёт на `https://trenio.by`, не на `trenio.local`.

Android: после JDK 17 и Android SDK `npm run mobile:android` собирает debug. На этой машине SDK нет, поэтому команда останавливается сообщением и кодом 0.

## Что в репозитории изменено по областям

Сервер и схема:

- `src/auth/auth-schema.ts`, `src/auth/service.ts`, `src/auth/apple-account.ts`
- `src/db/schema/users.ts`, `push-subscriptions.ts`, `user-devices.ts`, `index.ts`
- `src/lib/auth/auth-decisions.ts` — `decideAppleLink`
- `src/lib/mobile/http.ts`, `apple-token.ts`, `apple-claims.ts`, `devices.ts`, `device-body.ts`, `paths.ts`, `well-known.ts`, `shell-detect.ts`, `apns.ts`
- `src/lib/http/request-cookie.ts`
- `src/lib/messages/push.ts`, `push-schema.ts`, `live-socket.ts`
- `src/start.ts`
- `src/routes/open.tsx`
- `scripts/apply-apple-login.ts`

Сайт:

- кнопки входа: `apple-login-button.tsx`, правки Google и Яндекса, логин, регистрация, дверь тренера
- `src/lib/native/shell.ts`
- `src/components/brand-icons.tsx`
- `src/components/messages/message-composer.tsx`
- `src/routes/map.tsx`, `src/routes/__root.tsx`
- выход: шапка и кабинеты, перечисленные выше
- `public/sw.js`, `public/offline.html`

Оболочки:

- `capacitor.config.ts`
- `mobile/www/index.html`
- `mobile/ios/**` вместе с Info.plist, entitlements и PrivacyInfo
- `mobile/android/**` — Gradle-проект TWA, wrapper, иконки, `signing.gradle`
- `src/db/migrations/0001_mobile_shell.sql` — те же операторы, что выполняет `apple:install`. Drizzle Kit этот файл не запускает
- `scripts/build-mobile.sh`
- `scripts/build-mobile-android.sh`
- `.github/workflows/mobile.yml`

Проверки и описание:

- `src/lib/mobile/shell-rules.test.ts`, `load.test.ts`, `http.test.ts`
- `e2e/mobile-shell.spec.ts`
- `scripts/load-mobile.mjs`
- `package.json`, `vite.config.ts`, `.env.example`, `.gitignore`
- `docs/TECH_SPEC.md`, `docs/AUTH.md`, `docs/ACCOUNT_MODEL.md`, `docs/README.md`
- `.cursor/skills/trenio-logging/reference.md`

## Где лежит код, который промпт называет иначе

Промпт просил каталог `src/lib/push/` и статические файлы в `public/.well-known/`. Рабочий код остаётся там, где он уже вызывается. Второго обработчика рядом нет.

| Что просил промпт | Где это в репозитории |
| --- | --- |
| `POST /api/push/register` | `src/lib/mobile/http.ts`, запись в `src/lib/mobile/devices.ts` |
| `POST /api/auth/apple` | тот же `http.ts`, учётная запись в `src/auth/apple-account.ts` |
| проверка JWT | `src/lib/mobile/apple-token.ts`, `apple-claims.ts` |
| отправка APNs | `src/lib/mobile/apns.ts`, вызов из `src/lib/messages/push.ts` |
| `assetlinks.json` и association | `src/lib/mobile/well-known.ts`, отдаёт `handleMobileApi` |
| SQL | `src/db/migrations/0001_mobile_shell.sql` и `npm run apple:install` |

Файлы `.well-known` не лежат в `public/`. Статический файл не умеет подставить отпечаток Play и team id из окружения сервера и может уехать с неверным `Content-Type`. Обработчик отдаёт `application/json`.

## Что из промпта v2 в код не переносилось

Эти пункты в тексте промпта есть. В работающем сайте они ломают то, что уже проверено.

- `CapacitorHttp.enabled`. Документ оболочки и так открыт на `https://trenio.by`, cookie сессии — первого лица. Прокси всех `fetch` через нативный клиент рвёт сокет сообщений и чужие ответы. Включён `CapacitorCookies`.
- `overrideUserAgent` целиком. К обычному агенту Safari дописывается `Trenio-iOS/1.0`. Полная замена ломает Яндекс.Карты.
- `ios.scrollEnabled: false`. Страница сайта скроллится внутри WKWebView. Выключенный скролл останавливает каталог.
- `webDir: dist/client`. Сборка Vite — сервер Nitro, не статический сайт. Запасная страница оболочки — `mobile/www`.
- `ios.contentInset: always`. Отступ уже даёт CSS `env(safe-area-inset-*)`. В конфиге стоит `automatic`, чтобы отступ не удвоился.
- Origin `capacitor://localhost`, `app://localhost`, `ionic://localhost` в белом списке сокета. При `server.url` на боевой сайт документ живёт на `https://trenio.by`. Тест `socket-origin` фиксирует отказ `capacitor://`.
- Токен APNs в `push_subscriptions`. Там обязательны ключи браузера `p256dh` и `auth`. Токен телефона лежит в `user_devices`.
- Удаление всех токенов платформы при новой регистрации. Второй iPhone того же человека остаётся. Снимается только `replacedToken` этой установки, плюс тот же токен у другого аккаунта.
- Приём `android` / `fcm` / `web` на `/api/push/register`. Тело принимает только `ios` и `apns`. Браузерный Web Push идёт прежним путём VAPID.
- Firebase и `firebase-admin`. TWA пользуется Chrome, а Chrome уже получает Web Push сайта. FCM добавляется только если на устройстве TWA этот пуш не дойдёт.
- Журнал `auth.apple.success`. Действие называется `auth.login.apple`, как остальные входы. Токен в строку не пишется.
- `npm run build && cap sync android`. Сборка сайта оболочку не кормит, Android-проекта Capacitor нет и не будет.

## Чего ещё нет

- аккаунтов Apple Developer и Google Play, оплаты $99 и $25, карточек сторов;
- файлов `.p8` и keystore;
- отпечатка Play в `assetlinks.json` и team id в association на боевом сервере;
- сборки, которую можно поставить на телефон: нет Xcode.app, нет JDK и нет Android SDK;
- исходников `assets/icon.png` и `assets/splash.png` для `npm run mobile:assets`. Знак уже лежит в каталогах iOS и Android: квадрат 1024, тёмный и тонированный варианты, слои adaptive icon и `store_icon.png`;
- закрытого теста Play на 14 дней и 12 человек;
- проверки на живом iPhone: пуш, Apple, Universal Links, камера, cookie после выгрузки;
- записи Apple-аккаунта в базу внутри автотеста;
- FCM.

Пока это не сделано, релиза в сторах нет. Сайт в браузере от этих файлов не меняет сценарий входа через Google, Яндекс, почту и SMS.
