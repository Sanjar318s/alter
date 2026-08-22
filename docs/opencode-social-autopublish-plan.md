# План реализации: автомодерация + автопубликация в соцсети + синхронизация реакций

Документ для AI-агента **OpenCode**. Контекст этого чата недоступен. Не задавать уточняющих вопросов — выполнять по этому файлу. Если встречен маркер `[ТРЕБУЕТ РЕШЕНИЯ ПОЛЬЗОВАТЕЛЯ: …]`, **не выдумывать иное**: использовать указанный **дефолт реализации** (он зафиксирован рядом с маркером), пока владелец репозитория явно не переопределил его.

Не писать код длиннее 15–20 строк в этом документе — ниже логика и порядок вызовов. Реализацию делать в репозитории `github.com/Sanjar318s/alter`, ветка `main`.

---

## 0. Факты о репозитории (проверено по коду, не выдумывать)

| Что | Как есть сейчас |
|-----|-----------------|
| Frontend | `frontend/` — Next.js (App Router), прод `https://altercosplay.vercel.app`, API `NEXT_PUBLIC_API_URL` |
| Backend | `backend/` — Express 5, Fly.io app `alter-api-young-lantern-9418`, регион `sin`, процесс `app` = `node dist/index.js`, процесс `telegram` = poller |
| БД | Drizzle + SQLite-совместимый драйвер: локально `better-sqlite3` (`backend/data/alter.db`), в проде Turso через `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` (`backend/src/db/index.ts`) |
| Миграции | **не** drizzle-kit push. Схема живого прод-БД накатывается императивно в `backend/src/db/migrate.ts` (`CREATE TABLE IF NOT EXISTS` + `addColumn()`). Drizzle-типы дублируются в `backend/src/db/schema.ts`. **Любая новая таблица/колонка обязана появиться в ОБОИХ файлах.** |
| Медиа | Cloudflare R2 (если заданы `R2_*`) иначе локальная папка `uploads/`. URL файлов публично читаемые. Код: `backend/src/lib/storage.ts` |
| Рилсы | таблица `publications`, `kind = 'post' \| 'story'`. Лента: `GET /api/publications/feed`. Создание: `POST /api/publications` в `backend/src/routes/publications.ts`. Клиент (`platformRole=client`) не может создавать. Stories (`kind=story`) истекают за 24ч — **в соцсети не кросспостить**. |
| Работы | таблица `builds` + `build_photos`. Создание: `POST /api/builds` в `backend/src/routes/builds.ts`. Публиковать работы может только `seller` (и owner-bypass, если уже сделан). Скрытые `hidden=1` — **не кросспостить**. |
| Поля контента | Publication: `caption`, `mediaJson` (JSON array URL), `tagsJson`. Build: `title`, `description`, `franchise`, `character`, `coverImageUrl`, `tagsJson`, фото в `build_photos.image_url`. |
| Уведомления | `backend/src/lib/notify.ts` → таблица `notifications` + realtime. Использовать это, не Resend. |
| Фоновые задачи сейчас | `setInterval` внутри `backend/src/index.ts` (эскалация жалоб, inactivity purge). **Проблема:** в `backend/fly.toml` у HTTP-сервиса `auto_stop_machines = 'stop'` и `min_machines_running = 0` — машина **засыпает**, интервалы **ненадёжны**. Telegram вынесен в отдельный процесс `[processes] telegram`. Очередь соцсетей делать **отдельным процессом Fly**, по тому же паттерну. |
| Админка | `frontend/src/app/admin/page.tsx` + `frontend/src/components/admin/AdminDashboard.tsx`. API: `backend/src/routes/admin.ts` (уже `authMiddleware` + `adminMiddleware`). Owner: username `nyx.cosplay` (`backend/src/lib/owner.ts`). |
| Существующие «интеграции» | `backend/src/routes/integrations.ts` — только Telegram sync secret. Не расширять этот файл всем OAuth — завести отдельный модуль social. |
| Политика | `frontend/src/app/privacy/page.tsx` уже упоминает будущую автопубликацию. Дополнить фактами (какие данные уходят, opt-in). Публичный URL политики: `https://altercosplay.vercel.app/privacy` |
| Помощь | `frontend/src/app/help/page.tsx`, `frontend/src/app/about/page.tsx` уже обещают YouTube/IG/FB/TikTok — после реализации не врать про «скоро». |
| KV | таблица `app_kv` (`key`, `value`) — использовать для счётчиков квот Gemini/YouTube за UTC-день. |
| `moderation_requests` | заточена под смену роли (`type='role_change'`). **Не переиспользовать** под контент — отдельная таблица. |
| Бесплатный стек | Gemini AI Studio (бесплатный ключ), YouTube Data API (квота 10 000 units/день), Meta Graph в Development, TikTok Content Posting до аудита только private. Redis/Bull/Cloudinary/платный worker — **не подключать**. |

Публичные ссылки на контент (подставлять в описания соцсетей):

- Профиль автора: `https://altercosplay.vercel.app/profile/{username}`
- Работа: `https://altercosplay.vercel.app/build/{id}`
- Рилсы: отдельного permalink у publication нет — использовать профиль + при желании `/reels`. Не создавать новые публичные роуты в этой задаче, если не нужно для Meta/TikTok preview.

---

# 1. Контекст и цель

Платформа AlterCosPlay должна **после создания рилса (блогером/продавцом) или работы (продавцом)**:

1. Прогнать медиа+текст через Gemini (тематика косплей/костюмы/реквизит/процесс).
2. При «да» — поставить асинхронные джобы публикации на **канал/страницы владельца платформы** (не в личные аккаунты авторов).
3. Сформировать описание: ник, ссылка на профиль, хэштеги, фирменная приписка AlterCosPlay.
4. Периодически подтянуть лайки/комментарии с площадок и показать их на платформе **отдельно** от внутренних лайков (`publications.likesCount` / `builds.likesCount` не перезаписывать внешними цифрами).

Кросспост идёт на **аккаунты бренда AlterCosPlay**, которыми владеет owner (`nyx.cosplay`). Авторы дают согласие на репост.

## Критерий «готово» по подсистемам

### 1) Автомодерация

- После `POST /api/publications` (`kind=post`) и `POST /api/builds` создаётся запись модерации `pending`.
- Воркер вызывает Gemini, пишет `approved` / `rejected` / `review`.
- `approved` → джобы публикации в нужные площадки (см. маршрутизацию ниже).
- `rejected` → наружу не публикуется; автору **мягкое in-app уведомление** (не email). Контент на AlterCosPlay остаётся видимым.
- `review` → в админке owner видит очередь, кнопки «Разрешить» / «Отклонить»; до решения публикации нет.
- Счётчик вызовов Gemini за UTC-сутки пишется в `app_kv`; при исчерпании лимита новые проверки ждут, система не падает.

### 2) YouTube Shorts

- Источник: только **рилсы** (`publications.kind='post'`), прошедшие модерацию, автор blogger или seller (или owner).
- Загрузка на YouTube-канал владельца через Data API v3, не синхронно в HTTP-хендлере создания.
- В описании: caption, `@username`, URL профиля, хэштеги, приписка про AlterCosPlay.
- Не больше **5 успешных `videos.insert` в сутки** (квота ~1600 units за upload, дневной лимит 10000).
- В БД сохранён `youtube_video_id`; статус `published` / `failed` / `queued`.

### 3) Instagram + Facebook

- Источник: только **работы** (`builds`, не hidden), прошедшие модерацию.
- Фото → Instagram Feed post + Facebook Page photo. Видео → Instagram Reel + Facebook Reel/video. **Stories не использовать** (24ч, портфолио потеряется).
- Сначала только Meta **Development / sandbox** (тестовые пользователи). Отдельный чеклист App Review — не блокирует merge sandbox-кода.
- В БД: `ig_media_id`, `ig_permalink`, `fb_post_id`.

### 4) TikTok

- Источник: те же рилсы, что YouTube.
- До прохождения Audit все посты `privacy_level = SELF_ONLY` (видны владельцу приложения). В БД флаг `tiktok_visibility = private_pending_audit`.
- После Audit: новые посты можно слать публичными; **уже залитые private нельзя сделать публичными тем же id** — отдельная команда «переопубликовать публично» создаёт **новый** пост через `PULL_FROM_URL` того же R2-файла, старый id сохраняется в `tiktok_legacy_publish_id`.
- В админке чеклист аудита (см. §4.4).

### 5) Обратная синхронизация реакций

- Крон воркера (не чаще 1 раза в 6 часов на пост, глобально пачками) читает counts YouTube/IG/TikTok.
- На карточке рилса/работы показывается блок «В соцсетях: N лайков · M комментариев» плюс иконки площадок со статусом. Пока нет данных: «Скоро появится в соцсетях» / «Ожидает модерации» / «Опубликовано, счётчики обновляются…» по статусу.
- Ответы с AlterCosPlay **в** соцсети не реализуются.

### Маршрутизация контента → площадки (зафиксировано)

| Контент | YouTube Shorts | TikTok | Instagram | Facebook |
|---------|----------------|--------|-----------|----------|
| Рилс (`publications` post) | да | да | нет | нет |
| Работа (`builds`) | нет | нет | да | да |
| Publication story | нет | нет | нет | нет |
| client-роль | не создаёт этот контент | | | |

[ТРЕБУЕТ РЕШЕНИЯ ПОЛЬЗОВАТЕЛЯ: opt-in авторов.] **Дефолт реализации:** колонка `users.social_crosspost_opt_in INTEGER DEFAULT 1` для существующих; на UI создания рилса/работы чекбокс «Разрешить репост в соцсети AlterCosPlay» включён, можно снять. Если снято — модерацию Gemini **не вызывать** (экономия квоты), строка outbound не создаётся. Скрытие чекбокса у client не нужно (они не публикуют). Если владелец захочет default 0 — одна миграция default и смена UI.

[ТРЕБУЕТ РЕШЕНИЯ ПОЛЬЗОВАТЕЛЯ: уведомлять ли автора об отклонении Gemini.] **Дефолт:** мягкое in-app `notify(userId, "social_moderation_rejected", { text, contentType, contentId })`. Без email. Текст: «Этот материал останется на AlterCosPlay, но не уйдёт в соцсети бренда — тематика должна быть про косплей, костюмы или процесс.» Не блокировать публикацию на самой платформе.

---

# 2. Схема данных

Добавить в `backend/src/db/migrate.ts` внутри `migrate()` новые `CREATE TABLE IF NOT EXISTS` + индексы. Зеркало типов — `backend/src/db/schema.ts`. Колонку на `users` — через уже существующий хелпер `addColumn("users", "social_crosspost_opt_in", "INTEGER DEFAULT 1")`.

Не добавлять youtube_id прямо в `publications`/`builds` — нормализовать.

### 2.1. `users.social_crosspost_opt_in`

```sql
-- через addColumn:
-- social_crosspost_opt_in INTEGER DEFAULT 1
```

### 2.2. `social_moderation` — один ряд на единицу контента

```sql
CREATE TABLE IF NOT EXISTS social_moderation (
  id TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,          -- 'publication' | 'build'
  content_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected | review
  confidence TEXT,                     -- high | medium | low (из ответа модели)
  reason TEXT,                         -- краткое пояснение модели/модератора
  gemini_model TEXT,
  gemini_raw_json TEXT,                -- усечь до 8KB при записи
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (content_type, content_id)
);
CREATE INDEX IF NOT EXISTS idx_social_moderation_status ON social_moderation(status);
```

### 2.3. `social_jobs` — очередь (модерация, публикация, sync, tiktok_repost)

```sql
CREATE TABLE IF NOT EXISTS social_jobs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,                  -- moderate | publish | sync | tiktok_public_repost
  platform TEXT,                       -- youtube | instagram | facebook | tiktok | null для moderate
  content_type TEXT NOT NULL,
  content_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued', -- queued | running | done | failed | deferred
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  run_after INTEGER NOT NULL DEFAULT (unixepoch()), -- unix seconds, для defer из-за квот
  locked_at INTEGER,
  last_error TEXT,
  payload_json TEXT,                   -- необязательный контекст
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_social_jobs_poll ON social_jobs(status, run_after);
```

Правило уникальности активной джобы: перед insert проверять отсутствие `queued|running|deferred` с тем же `(kind, platform, content_type, content_id)`. Иначе дубли при двойном клике.

### 2.4. `social_posts` — факт публикации на площадке

```sql
CREATE TABLE IF NOT EXISTS social_posts (
  id TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  content_id TEXT NOT NULL,
  platform TEXT NOT NULL,              -- youtube | instagram | facebook | tiktok
  status TEXT NOT NULL,                -- queued | publishing | published | failed | private_pending_audit | superseded
  external_id TEXT,                    -- videoId / ig media id / fb post id / tiktok publish_id
  external_url TEXT,
  tiktok_visibility TEXT,              -- private_pending_audit | public | null
  tiktok_legacy_publish_id TEXT,       -- предыдущий private id после репоста
  source_media_url TEXT,               -- канонический R2 URL для повторного PULL
  title TEXT,
  description TEXT,
  hashtags_json TEXT,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  last_synced_at INTEGER,
  published_at INTEGER,
  error TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (content_type, content_id, platform)
);
CREATE INDEX IF NOT EXISTS idx_social_posts_content ON social_posts(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_sync ON social_posts(status, last_synced_at);
```

### 2.5. `social_oauth_tokens` — токены владельца (один ряд на провайдера)

```sql
CREATE TABLE IF NOT EXISTS social_oauth_tokens (
  provider TEXT PRIMARY KEY,           -- youtube | meta | tiktok
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at INTEGER,
  extra_json TEXT,                     -- ig_user_id, page_id, channel_id, open_id
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

Токены писать как есть в Turso (уже секретная БД). Не логировать access_token в stdout.

### 2.6. Счётчики квот в `app_kv`

Ключи:

- `social_quota:gemini:YYYY-MM-DD` → число вызовов
- `social_quota:youtube_uploads:YYYY-MM-DD` → число videos.insert
- `social_settings` → JSON `{ tiktokAuditApproved: boolean, metaLiveMode: boolean, youtubeDailyUploadCap: 5 }`

### 2.7. Что НЕ добавлять

- Не плодить колонки на `publications` / `builds`.
- Не использовать `moderation_requests` для контента.
- Не хранить бинарники видео в БД.

---

# 3. Затрагиваемые и новые файлы

## Backend — создать

| Путь | Назначение |
|------|------------|
| `backend/src/lib/social/constants.ts` | хэштеги ниши, тексты приписок, лимиты квот, SITE_URL |
| `backend/src/lib/social/copy.ts` | сборка description + hashtags из publication/build |
| `backend/src/lib/social/media.ts` | выбрать URL видео vs фото; HEAD content-type; скачать buffer с лимитом размера |
| `backend/src/lib/social/gemini.ts` | вызов Gemini, парсинг JSON-ответа, учёт квоты |
| `backend/src/lib/social/queue.ts` | enqueue, claimJob, complete/fail/defer |
| `backend/src/lib/social/youtube.ts` | OAuth refresh + resumable upload |
| `backend/src/lib/social/meta.ts` | IG container + publish, FB photo/video |
| `backend/src/lib/social/tiktok.ts` | Content Posting init/status, PULL_FROM_URL |
| `backend/src/lib/social/sync.ts` | чтение counts |
| `backend/src/lib/social/worker.ts` | цикл обработки одной джобы |
| `backend/src/scripts/socialWorker.ts` | процесс Fly: poll loop |
| `backend/src/routes/adminSocial.ts` | OAuth callbacks, очередь review, настройки, tiktok republish — подключить из `admin.ts` или `index.ts` как `/api/admin/social` |

## Backend — изменить

| Путь | Что сделать |
|------|-------------|
| `backend/src/db/schema.ts` | таблицы + `users.socialCrosspostOptIn` |
| `backend/src/db/migrate.ts` | SQL из §2 |
| `backend/src/routes/publications.ts` | после успешного insert post: если opt-in и kind=post → enqueue `moderate` |
| `backend/src/routes/builds.ts` | после успешного insert (не hidden) + opt-in → enqueue `moderate` |
| `backend/src/routes/publications.ts` GET feed/user | присоединить агрегат `social` из `social_posts` (без N+1: batched `inArray` как уже сделано в `enrichBatched`) |
| `backend/src/routes/builds.ts` GET list/one | то же поле `social` |
| `backend/src/index.ts` | `app.use("/api/admin/social", adminSocialRoutes)` (роутер сам ставит auth+owner) |
| `backend/fly.toml` | процесс `social` (см. §6) |
| `backend/package.json` | скрипт `"social:worker": "tsx src/scripts/socialWorker.ts"`; зависимость `@google/generative-ai` **или** сырой `fetch` к `generativelanguage.googleapis.com` (предпочтительнее **fetch без новой SDK**, чтобы не раздувать образ). YouTube/Meta/TikTok — тоже `fetch`, без googleapis SDK если возможно. |
| `backend/src/lib/notify.ts` | не обязателен к правке, только вызывать `notify` |

## Frontend — создать

| Путь | Назначение |
|------|------------|
| `frontend/src/components/admin/AdminSocialPanel.tsx` | очередь `review`, статусы последних постов, кнопки OAuth, тоггл `tiktokAuditApproved`, кнопка «Переопубликовать TikTok публично» |
| `frontend/src/components/social/SocialStats.tsx` | компактный блок счётчиков под рилсом/работой |
| `frontend/src/lib/socialCopy.ts` | только если шаринг на клиенте понадобится — иначе не создавать |

## Frontend — изменить

| Путь | Что сделать |
|------|-------------|
| `frontend/src/lib/api.ts` | методы `admin.social.*` и опционально поле в типах publication/build |
| `frontend/src/app/admin/page.tsx` | вставить `AdminSocialPanel` (только owner) |
| `frontend/src/components/admin/AdminDashboard.tsx` | слот/секция «Соцсети» либо рендер панели рядом с RoleChange — **не ломать** существующие вкладки жалоб |
| `frontend/src/components/profile/CreatePublicationModal.tsx` | чекбокс opt-in (значение по умолчанию из `/api/account/me`) |
| форма создания работы (профиль, модалка «Добавить работу» в `frontend/src/app/profile/[username]/page.tsx`) | тот же чекбокс |
| `frontend/src/app/me/page.tsx` | переключатель «Репост в соцсети бренда» → PATCH account |
| `frontend/src/components/reels/ReelsFeed.tsx` | `<SocialStats />` |
| `frontend/src/app/build/[id]/page.tsx` | `<SocialStats />` |
| `frontend/src/components/profile/PublicationGrid.tsx` / PostLightbox | по желанию тот же блок |
| `frontend/src/app/privacy/page.tsx` | абзац: opt-in, какие площадки, что данные — медиа+ник+ссылка |
| `frontend/src/app/help/page.tsx` | заменить «скоро» на актуальное поведение, когда фича включена флагом |

## Не трогать

- RoleSelectModal, inactivity purge, telegram process, схему `moderation_requests` role_change, Resend/OTP.
- Не деплоить Meta Live, пока нет App Review — код sandbox должен работать за флагом `metaLiveMode=false`.

---

# 4. Пошаговые инструкции по подсистемам

Общий порядок реализации (зависимости):

1. Миграции + queue helpers + enqueue из POST publication/build (ещё без Gemini — джобы висят `queued`).
2. Gemini moderate worker + админка review.
3. YouTube OAuth + publish worker (рилсы).
4. Meta sandbox + publish worker (работы).
5. TikTok private + флаг аудита + republish.
6. Sync worker + UI SocialStats.
7. fly.toml process + секреты + проверка.

Пока шаг N не зелёный по §7, не начинать N+2.

---

## 4.1. Автомодерация (Gemini)

### Модель и эндпоинт

- Модель по умолчанию: env `GEMINI_MODEL` = `gemini-2.0-flash` (если 404 — `gemini-2.5-flash` или `gemini-flash-latest`, переключается env, без хардкода одного id в пяти файлах).
- HTTP: `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}`
- Тело: `contents[0].parts` = массив `{text}` + `{inline_data: {mime_type, data: base64}}` **или** `{file_data}` если используется Files API.

### Что отправлять

1. Системный текст (на русском+инструкции JSON): роль классификатора. Разрешённая тема: косплей, костюмы, парики, грим, реквизит, процесс пошива/брони, персонажи, конвенты косплея. Запрещено для автопостинга бренда: NSFW, оружие IRL как угроза, политика, чистый UGC не про косплей (еда, кот без костюма, случайные селфи), спам, водяные знаки чужих магазинов как основной смысл.
2. Текст: caption/title/description/franchise/character/tags.
3. Медиа:
   - Если первый URL — image (`image/jpeg|png|webp`): скачать ≤ 4 МБ, base64 inline.
   - Если video: **не** тащить весь файл в 512MB VM. Либо (а) Gemini Files API `POST https://generativelanguage.googleapis.com/upload/v1beta/files` с маленьким клипом, либо (б) если есть постер/первое фото в `mediaJson`/`coverImageUrl` — слать кадр + подпись «это обложка видео». **Дефолт:** для видео слать **обложку** (cover или первый image в массиве) + текст «media is video». Если обложки нет — `status=review` без вызова Gemini (экономия + честный uncertain).

Ответ модели требовать **строго JSON** (prompt: верни только JSON):

```json
{"verdict":"yes"|"no"|"unsure","confidence":"high"|"medium"|"low","reason":"…"}
```

Маппинг:

- `yes` + confidence не `low` → `approved`
- `no` + confidence `high` → `rejected`
- иначе (`unsure`, `low`, парсинг сломался, safetyblock Gemini) → `review`

### Квоты Gemini (бесплатный ключ, консервативно)

В коде константы (можно перекрыть env):

- `GEMINI_MAX_PER_DAY = 200`
- `GEMINI_MIN_INTERVAL_MS = 8000` (не более ~7–8 RPM)

Перед вызовом: прочитать `app_kv` ключ дня; если `>= MAX` → `defer` джобы на `now+1h` (не fail). Между вызовами sleep в воркере.

Лог: `console.log("[social] gemini", { contentType, contentId, verdict, dayCount })` без raw image.

### Встраивание в create-handlers

В `POST /api/publications` после insert, если `kind==='post'` и user.socialCrosspostOptIn:

1. INSERT `social_moderation` pending.
2. INSERT `social_jobs` kind=`moderate`.

Аналогично `POST /api/builds`.

Не вызывать Gemini внутри HTTP-запроса создания — только enqueue (ответ клиенту как сейчас, 201).

### Админка ручной очереди

`GET /api/admin/social/review` — owner: список `status=review` + превью URL + reason.

`POST /api/admin/social/review/:id` body `{ decision: "approved"|"rejected", note? }`:

- approved → enqueue publish-джобы по маршрутизации §1.
- rejected → notify автора мягко, как Gemini-no.

Права: только `isOwnerUsername` / `isOwnerById`, не любой admin (публикация идёт от бренда).

### После approved

Функция `enqueuePublishes(contentType, contentId)`:

- publication → jobs `publish` youtube + tiktok + rows `social_posts` status=`queued`
- build → jobs `publish` instagram + facebook

Если токен провайдера отсутствует — job `deferred` с error `oauth_missing`, пост `failed` не ставить сразу (чтобы после OAuth подхватилось).

---

## 4.2. YouTube Shorts

### OAuth (без Google App Review)

Использовать проект Google Cloud в статусе **Testing**, test user = аккаунт канала AlterCosPlay. Состав testers до 100 — owner единственный пользователь. Scopes:

- `https://www.googleapis.com/auth/youtube.upload`
- `https://www.googleapis.com/auth/youtube.readonly` (для sync статистики)

Тип клиента: **Web application**. Redirect:

`https://alter-api-young-lantern-9418.fly.dev/api/admin/social/youtube/callback`

Локально также `http://localhost:4000/api/admin/social/youtube/callback`.

Поток:

1. Owner в админке «Подключить YouTube» → `GET /api/admin/social/youtube/start` редирект на `https://accounts.google.com/o/oauth2/v2/auth` с `access_type=offline&prompt=consent&scope=...`
2. Callback: `POST https://oauth2.googleapis.com/token` (code → tokens). Сохранить в `social_oauth_tokens` provider=`youtube`. `extra_json.channelId` получить через `GET https://www.googleapis.com/youtube/v3/channels?part=id&mine=true`.

Refresh: если `expires_at < now+60s` → `POST https://oauth2.googleapis.com/token` grant_type=refresh_token.

### Публикация (квота)

`videos.insert` ≈ 1600 units. Лимит кода: 5 загрузок/UTC-день (`YOUTUBE_DAILY_UPLOAD_CAP`). Если кап исчерпан — `defer` до `unixepoch следующего UTC 00:05`.

Порядок API:

1. Проверить квоту kv.
2. Скачать видео во временный файл `/tmp/{id}.mp4` (Fly: диск ephemeral). Если media не video — `failed` с error `not_video`, не ретраить.
3. Resumable upload:
   - `POST https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status`
   - headers: `Authorization: Bearer`, `X-Upload-Content-Type`, `X-Upload-Content-Length`
   - body JSON snippet: `title` (caption обрезать до 90 символов или «Cosplay · @username»), `description` из `copy.ts`, `categoryId` = `24` (Entertainment) или `22`, `tags` массив без `#`
   - status: `privacyStatus=public`, `selfDeclaredMadeForKids=false`
   - PUT бинаря на Location из шага 1.
4. Сохранить `id` ответа в `social_posts.external_id`, `external_url=https://youtube.com/shorts/{id}`, status=`published`, increment kv uploads.
5. Удалить `/tmp` файл.

Ограничения Shorts: вертикальное видео YouTube определяет сам; не перекодировать на Fly (нет CPU). Если upload 400 — failed + last_error.

Ретраи: 429/5xx → attempts++, defer 15m, 1h, 6h. После max_attempts — failed, не валить воркер.

---

## 4.3. Instagram и Facebook (Meta Graph)

### Подготовка (ручная, один раз — описать в README админки)

1. Meta Developer App (тип Business).
2. Development mode. Добавить Instagram tester + Facebook Page, которой владеет owner.
3. Instagram Professional (Business/Creator), привязанный к этой Page.
4. Permissions в dev: `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`.

### OAuth

Redirect: `https://alter-api-young-lantern-9418.fly.dev/api/admin/social/meta/callback`

Scopes те же. После code:

1. `GET https://graph.facebook.com/v21.0/oauth/access_token` exchange.
2. Long-lived: `fb_exchange_token`.
3. `GET /me/accounts` → выбрать Page (id в env `META_PAGE_ID` или первую).
4. `GET /{page-id}?fields=instagram_business_account,access_token` → `ig_user_id`, page access token. Сохранить page token (он не истекает так же, как user, но long-lived user всё равно хранить).

`extra_json`: `{ pageId, igUserId }`.

### Публикация Instagram — фото (Feed)

Документация: Content Publishing.

1. `POST https://graph.facebook.com/v21.0/{ig-user-id}/media`  
   `image_url={public R2 url}` (должен быть публично GET без auth)  
   `caption={copy}`
2. Поллить `GET /{creation_id}?fields=status_code` пока `FINISHED` (таймаут 2 мин, иначе defer).
3. `POST /{ig-user-id}/media_publish` `creation_id=...`
4. Сохранить id; permalink: `GET /{media-id}?fields=permalink`

### Публикация Instagram — видео (Reels)

1. `POST /{ig-user-id}/media`  
   `media_type=REELS`  
   `video_url={public R2 url}`  
   `caption=...`  
   `share_to_feed=true`
2. Поллить status_code `FINISHED` / `ERROR`.
3. `media_publish`.

Если R2 отдаёт файл только с подписью — **сломается**. Проверить, что `putUpload` даёт публичный URL (сейчас так и задумано). Если нет — отдельный шаг: временный публичный URL. Не делать прокси через Fly для гигабайтных PUT.

### Facebook Page

Фото: `POST /{page-id}/photos` `url=` `caption=` `access_token=page_token`.

Видео: `POST /{page-id}/videos` `file_url=` `description=`.

Писать отдельный `social_posts` ряд platform=`facebook` (даже если IG уже успешен). Ошибка одной площадки не откатывает другую.

### Sandbox vs Live

Пока `social_settings.metaLiveMode !== true` — публиковать можно, но контент виден только app testers. UI админки показывает баннер «Meta Development: посты не публичны». Чеклист App Review — §4.3.1, **не делать в том же PR**, что sandbox.

### 4.3.1. Чеклист Meta App Review (отдельный пункт, не код)

Когда sandbox проверен на тестовом IG:

1. Записать screencast: owner включает opt-in, создаёт работу, в админке виден статус published в Graph (тестовый аккаунт).
2. Privacy policy URL: `https://altercosplay.vercel.app/privacy` (текст обновлён).
3. Use cases: «Перепубликация портфолио продавца на бизнес-аккаунт бренда с согласия автора».
4. Запросить `instagram_content_publish`, `pages_manage_posts`.
5. После approve: поставить `metaLiveMode=true` в админке (пишет `app_kv`). Код смены режима — один флаг, без ветвления API.

---

## 4.4. TikTok Content Posting API

### До аудита

Все init-запросы: `privacy_level: "SELF_ONLY"`. В `social_posts`: `tiktok_visibility=private_pending_audit`, `status=published` (технически опубликовано, но не публично). Админка: бейдж «TikTok: только владелец приложения».

### OAuth TikTok

Redirect: `https://alter-api-young-lantern-9418.fly.dev/api/admin/social/tiktok/callback`

Scopes: `video.upload` / актуальные для Content Posting (`video.publish` если в консоли так названо). Токен + `open_id` в extra_json.

### Публикация (PULL_FROM_URL — не грузить файл повторно)

Порядок (актуальные хосты TikTok Open API, v2):

1. `POST https://open.tiktokapis.com/v2/post/publish/inbox/video/init/` (или `/v2/post/publish/video/init/` в зависимости от private vs public)  
   body: `post_info` { title/description, privacy_level, disable_duet/comment по желанию false }, `source_info` { source: `PULL_FROM_URL`, video_url: R2 public URL }
2. Сохранить `publish_id`.
3. Поллить `POST /v2/post/publish/status/fetch/` с `publish_id` пока `PUBLISH_COMPLETE` / `FAILED`.
4. Сохранить `source_media_url` = тот же video_url.

Если PULL_FROM_URL недоступен до аудита — fallback FILE_UPLOAD (chunked). Предпочесть PULL, чтобы репост после аудита не требовал локальный файл.

### После аудита

Настройка `tiktokAuditApproved=true` в админке (owner).

- Новые джобы: `privacy_level=PUBLIC_TO_EVERYONE` (или `EVERYONE` — сверить с докой на момент реализации, записать фактическое enum в `constants.ts`).
- Старые private: **не PATCH privacy** (API не даёт сменить). Кнопка «Сделать публичными ожидающие» создаёт jobs `kind=tiktok_public_repost` для каждого `private_pending_audit`. Воркер: новый init PUBLIC + тот же `source_media_url`. Старый `external_id` → `tiktok_legacy_publish_id`, новый id в `external_id`, visibility=`public`, status=`published`. Если init падает — не терять legacy id.

### Чеклист TikTok Audit (сделать в UI + legal)

Реализовать до подачи на Audit (иначе отклонят):

1. **Экран согласия** при создании рилса: явный чекбокс «Разрешаю AlterCosPlay опубликовать это видео в TikTok аккаунта бренда». Без галочки — джоба TikTok не создаётся (YouTube можно оставить на общем opt-in или том же чекбоксе — **дефолт: один общий opt-in на все площадки бренда**).
2. **Явная отметка** в UI: мелкий текст «Может появиться в TikTok @…». После publish — в SocialStats иконка TikTok.
3. **Privacy:** `https://altercosplay.vercel.app/privacy` содержит TikTok, какие данные (видео, ник, ссылка).
4. **UX гайдлайны TikTok:** не маскировать, что пост уйдёт в TikTok; не постить без согласия; кнопка отключения в `/me`.
5. Скриншоты/screencast этого флоу для заявки Audit.
6. Домен + callback URL в TikTok Developer Portal совпадают с Fly.

Код не подаёт Audit сам — только готовит продукт. В админке чеклист из 6 пунктов с галочками (локальный UI state + когда все true, owner жмёт «Я подал Audit») — опционально, можно markdown в панели.

---

## 4.5. Обратная синхронизация реакций

### Когда

Воркер каждые **20 минут** (sleep процесса) выбирает до 20 `social_posts` где `status in (published, private_pending_audit)` и `last_synced_at` IS NULL или старше 6 часов. Создавать отдельные jobs `kind=sync` **или** синкать прямо в том же процессе без таблицы — **дефолт: прямая выборка в socialWorker**, без размножения jobs, чтобы не забить очередь. Если sync упал — не менять counts, только log.

Не синкать чаще 6ч на пост (лимиты Graph/YouTube).

### YouTube

`GET https://www.googleapis.com/youtube/v3/videos?part=statistics&id={videoId}`  
→ `statistics.likeCount`, `commentCount`. Quota: 1 unit.

### Instagram

`GET /{ig-media-id}?fields=like_count,comments_count`

### Facebook

`GET /{post-id}?fields=reactions.summary(true),comments.summary(true)`  
или `likes.summary(true)`.

### TikTok

`POST https://open.tiktokapis.com/v2/video/query/` (или актуальный video/list) с `fields=like_count,comment_count` и `video_ids`. Если для SELF_ONLY статистика пустая — оставить 0, не ошибка.

### Отображение

API отдаёт на publication/build:

```
social: {
  moderationStatus: 'pending'|'approved'|'rejected'|'review'|null,
  posts: [{ platform, status, url, likesCount, commentsCount, tiktokVisibility }],
  totals: { likes, comments }
}
```

UI `SocialStats`:

- нет social / opt-out: ничего не показывать
- pending/review: «Проверяем для соцсетей…»
- rejected: ничего или серый «Только на AlterCosPlay» (не позорить автора) — **дефолт: не показывать**
- queued/publishing: «Готовим публикацию…»
- published и totals 0 и last_synced null: «Опубликовано · счётчики появятся позже»
- published и есть цифры: «YouTube 12 · TikTok 3» суммировать totals крупно, площадки мелко

Внутренние сердца лайков платформы **не заменять**.

Не реализовывать: ответ на комментарий IG/YT, импорт текста комментариев (только count). Если позже понадобится список — новая задача.

---

## 4.6. Сборка копирайта и хэштегов (`copy.ts`)

Широкие (всегда, латиницей+кириллица смесь ок, но YouTube tags лучше latin):

`#cosplay #костюм #реквизит #AlterCosPlay` плюс `#handmade` опционально.

Узкие:

- из `build.franchise`, `build.character` (пробелы убрать, `#GenshinImpact`)
- из `publication.tagsJson`
- из слов caption после `#`

Лимит: Instagram caption ≤ 2200; 20–25 хэштегов максимум.

Фирменная приписка (конец описания, RU):

```
Автор: @{username}
Профиль: {SITE_URL}/profile/{username}
Смотрите больше на AlterCosPlay и подписывайтесь на канал AlterCosPlay.
```

`SITE_URL` = env `PUBLIC_SITE_URL` default `https://altercosplay.vercel.app`.

---

# 5. Переменные окружения

Только ключи, без значений. Добавить в Fly secrets (`fly secrets set`) и в локальный `backend/.env` (файл в git не коммитить). Frontend новых секретов не получает (OAuth на бэкенде).

```
# уже есть, использовать
TURSO_DATABASE_URL
TURSO_AUTH_TOKEN
JWT_SECRET
PUBLIC_SITE_URL                 # если нет — завести, default прод URL сайта

# Gemini
GEMINI_API_KEY
GEMINI_MODEL                    # optional, default gemini-2.0-flash
GEMINI_MAX_PER_DAY              # optional, default 200

# YouTube / Google OAuth Web client
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET
GOOGLE_OAUTH_REDIRECT_URI       # https://alter-api-young-lantern-9418.fly.dev/api/admin/social/youtube/callback
YOUTUBE_DAILY_UPLOAD_CAP        # optional, default 5

# Meta
META_APP_ID
META_APP_SECRET
META_OAUTH_REDIRECT_URI         # .../api/admin/social/meta/callback
META_PAGE_ID                    # optional если определяется из /me/accounts
META_IG_USER_ID                 # optional fallback

# TikTok
TIKTOK_CLIENT_KEY
TIKTOK_CLIENT_SECRET
TIKTOK_OAUTH_REDIRECT_URI       # .../api/admin/social/tiktok/callback

# Worker
SOCIAL_WORKER                   # "1" в процессе social; в app-процессе не запускать цикл
SOCIAL_POLL_MS                  # optional, default 15000
```

Frontend: новых ключей нет. CORS в `index.ts` уже пускает `*.vercel.app`.

---

# 6. Асинхронность (Fly.io)

## Почему не setInterval в `index.ts`

`fly.toml` сейчас глушит HTTP-машину при простое. Очередь умрёт на часы. Telegram уже вынесен в отдельный process group.

## Новый процесс

В `backend/fly.toml`:

```
[processes]
  app = 'node dist/index.js'
  telegram = 'node dist/scripts/telegramPoll.js'
  social = 'node dist/scripts/socialWorker.js'
```

Добавить `[[vm]]` для `processes = ['social']` по аналогии с telegram (512mb shared). **Не** вешать `auto_stop` на этот процесс: у `[http_service]` указано `processes = ['app']`, поэтому social не HTTP и не должен стопаться вместе с app — проверить по доке Fly, что non-http process groups не наследуют auto_stop. Если наследуют — для social выставить в `[http_service]` только app и дать social отдельный `[[vm]]` без auto stop.

`[[restart]]` для social: `policy = 'on-failure'` (в отличие от telegram `never`).

## Цикл `socialWorker.ts`

Логика (псевдо, не копировать как готовый роман):

1. Если `process.env.SOCIAL_WORKER !== '1'` и argv не worker — exit. В fly.toml задать `social = 'node dist/scripts/socialWorker.js'` и внутри скрипта сразу цикл (можно не требовать SOCIAL_WORKER если entrypoint уникален).
2. `migrate()` не вызывать повторно обязательно — схема уже после app boot; на всякий случай вызвать `migrate()` идемпотентно.
3. Loop:
   - claim одну job: `UPDATE social_jobs SET status='running', locked_at=now, attempts=attempts+1 WHERE id = (выбрать id queued AND run_after<=now AND attempts<max ORDER BY created_at LIMIT 1)` — на Turso делать в транзакции: SELECT id, затем UPDATE WHERE id AND status='queued' проверить changes===1 (оптимистичный лок).
   - switch kind → moderate | publish | tiktok_public_repost.
   - catch: fail/defer, **никогда** не пробрасывать наружу до падения процесса кроме OOM.
   - если jobs нет: sync-проход §4.5 (не чаще чем раз в 20 мин — хранить lastSyncPassAt в памяти процесса).
   - sleep `SOCIAL_POLL_MS`.

HTTP создания контента **только INSERT job**. Никакого await YouTube в `/api/publications`.

## Идемпотентность

Повторный publish той же пары content+platform: если `social_posts.external_id` уже есть и status published — job сразу `done`.

---

# 7. Как проверить

Локально: Turso не обязателен (sqlite file). Worker: второй терминал `npm run social:worker` из `backend/`. Gemini ключ нужен даже локально для шага 1.

## Подсистема 1 — модерация

1. Включить opt-in. Создать рилс с фото косплея. В БД: `social_moderation` pending → approved (или review). HTTP 201 сразу, без ожидания Gemini.
2. Создать рилс с фото еды/оффтопик. Ожидание: rejected или review; в соцсети jobs publish нет; есть notification.
3. Подменить/отключить ключ Gemini: джоба deferred/review, API сайта жив, `/api/health` ok.
4. Owner `/admin`: карточка review, кнопка Разрешить создаёт publish jobs.
5. Счётчик `app_kv` растёт; искусственно поставить count=MAX — новые moderate не вызывают сеть, defer.

## Подсистема 2 — YouTube

1. Owner подключает OAuth, в таблице tokens есть refresh.
2. Прогнать тестовый вертикальный mp4 рилс approved. Worker: одно videos.insert, в YouTube Studio видео на канале, description содержит @username и altercosplay.vercel.app.
3. Сделать 5 успешных за день — 6-я deferred до завтра.
4. Не-видео рилс (только фото): youtube job failed `not_video`, tiktok тоже failed, сайт не 500.

## Подсистема 3 — Meta

1. App Development, tester IG. Работа-фото → появляется в тестовом IG и на Page (testers).
2. Работа-видео → Reel container FINISHED.
3. Без Meta токена: jobs deferred `oauth_missing`, создание работы на сайте ок.
4. Не вызывать Live Review в этом шаге.

## Подсистема 4 — TikTok

1. До аудита: пост SELF_ONLY, в админке бейдж private_pending_audit, в обычном TikTok приложения не искать.
2. Поставить tiktokAuditApproved, нажать republish: новый publish_id, legacy сохранён, source URL тот же.
3. Чекбокс согласия на создании рилса виден; без него нет tiktok job (при общем opt-in выкл — нет ни одной площадки).

## Подсистема 5 — sync

1. После published подождать цикл / вызвать sync вручную (owner POST `/api/admin/social/sync-now` — сделать узкий endpoint).
2. На `/reels` и `/build/{id}` видны внешние counts, внутренний like не совпадает обязательно.
3. Пока last_synced null — placeholder текст, не «0» как будто никто не лайкнул, если это путает. Если платформа вернула 0 после sync — показать 0.

Регрессия: создание рилса client по-прежнему 403; stories не попадают в social_moderation; hidden build не кросспостится.

---

# 8. Что может пойти не так

| Сбой | Поведение системы |
|------|-------------------|
| Gemini 429 / дневной кап | defer jobs; контент на сайте жив; админ видит очередь pending |
| Gemini hallucinates JSON | verdict=review, ручная очередь |
| Gemini ошибочно режет валидный косплей | автор видит мягкое уведомление; owner может approved вручную (нужен поиск по rejected в админке — список последних 50 rejected) |
| YouTube quota 403 | defer до следующего UTC day; не retry storm |
| YouTube refresh отозван | все youtube jobs deferred `oauth_revoked`; баннер в админке «переподключить» |
| R2 URL недоступен с IP Meta/TikTok | publish fail; last_error; ретраи 3 раза; проверить public bucket |
| Fly worker OOM на скачивании видео | лимит скачивания 80MB; больше — fail `too_large` без retry |
| auto_stop убил бы очередь | отдельный process social; если забыли прописать fly.toml — jobs копятся, после деплоя процесса разгребутся |
| Meta App Review отклонён | остаёмся в Development; `metaLiveMode` false; YouTube/TikTok не зависят |
| TikTok Audit отклонён | вечный private_pending_audit; продукт честно показывает «не публично»; нет бесконечных репостов |
| Дубль enqueue | unique active job + unique social_posts |
| Turso lock contention | одна джоба за раз в одном worker; не запускать два social-процесса |
| Комментарии/лайки API не отдают без extra scope | counts 0, last_synced всё равно поставить, чтобы не долбить |
| Автор снял opt-in после enqueue | перед publish проверять актуальный flag; если 0 — job done skip, посты не создавать |
| Удаление рилса/работы | ON DELETE cascade users есть; для content DELETE: в `DELETE /api/publications/:id` и builds delete — пометить social_posts и не синкать; **не** удалять ролики с YouTube автоматически в v1 (лишний scope + опасность). Дефолт: orphan posts остаются на канале бренда |
| NSFW проскочил Gemini | ручной review + owner удаляет на площадке руками; в v1 нет auto-takedown API |

Падение одной площадки не останавливает claim следующей job.

---

# 9. Тексты UI (чтобы агент не выдумывал тон)

- Чекбокс: «Разрешить репост в YouTube / Instagram / Facebook / TikTok аккаунтов AlterCosPlay»
- Уведомление reject: см. §1 дефолт
- Админка секция: «Соцсети бренда»
- Кнопки: «Подключить YouTube», «Подключить Meta», «Подключить TikTok», «Разрешить в соцсети», «Отклонить репост», «Переопубликовать TikTok как публичные»

---

# 10. Критерий завершения всей задачи

- Миграции накатываются на Turso через существующий `migrate()` при старте app.
- Worker process в `fly.toml` задеплоен.
- Секреты перечислены в §5 заданы на Fly (агент не знает значений — пользователь выставляет; в PR описать `fly secrets set KEY=`).
- Sandbox Meta и private TikTok работают без Review.
- YouTube testing OAuth грузит на канал owner.
- UI счётчиков и админ-очередь review на месте.
- Нет синхронных вызовов внешних API в POST создания контента.
- `publications.likesCount` / `builds.likesCount` не перезаписываются внешними цифрами.

Конец плана.
