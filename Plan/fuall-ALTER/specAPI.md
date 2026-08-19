# ALTER — API-контракт (specAPI.md)

> Общий API-слой для сайта (Next.js Route Handlers) и приложения (React Native + Expo) —
> см. specAPP.md §2 «тот же Turso + тот же API-слой, что у сайта». Схема данных — specWEB.md §4.
> Здесь — форма эндпоинтов, авторизация, коды ошибок; без конкретной OpenAPI-спеки (следующий
> уровень детализации — на старте реализации, когда зафиксируется финальная схема таблиц).

---

## 1. Авторизация

- Auth.js на вебе выдаёт сессионный JWT; приложение получает тот же JWT через тот же
  OAuth-флоу (Auth.js поддерживает мобильные редиректы через deep link `alter://auth-callback`)
- Все приватные эндпоинты — заголовок `Authorization: Bearer <jwt>`
- Токен хранится: веб — httpOnly cookie; приложение — Expo SecureStore (см. specAPP.md §2)
- Refresh — короткоживущий access-токен (15 мин) + refresh-токен (30 дней), ротация при
  каждом рефреше; приложение обновляет токен в фоне при 401
- Публичные эндпоинты (профиль, коммишен-страница, Explore) — доступны без токена, но
  с рейт-лимитом по IP (защита от скрейпинга/спама формы заявки)

## 2. Формат ответа

```json
// успех
{ "data": { ... }, "meta": { "cursor": "opaque-string" } }

// ошибка
{ "error": { "code": "COMMISSION_CLOSED", "message": "Коммишены сейчас закрыты" } }
```

Пагинация — курсорная (`?cursor=...&limit=20`), не `offset` (см. specWEB.md §2 —
требование к производительности на списках).

## 3. Основные группы эндпоинтов

### Auth
- `POST /api/auth/callback/:provider` — OAuth callback
- `POST /api/auth/refresh`
- `POST /api/auth/logout`

### Profiles
- `GET /api/profiles/:username` — публичный, отдаёт профиль + агрегаты (кол-во билдов, статус коммишена)
- `PATCH /api/profiles/me` — приватный, редактирование своего профиля
- `GET /api/profiles/:username/builds?cursor=` — пагинированный список билдов
- `GET /api/profiles/:username/stories?cursor=`

### Builds & Stories
- `POST /api/builds` — создание билда (multipart, фото + метаданные)
- `PATCH /api/builds/:id`
- `DELETE /api/builds/:id`
- `POST /api/builds/:id/photos` — добавление фото к билду, с полями `maker_id?`, `photographer_id?`
- `POST /api/stories`

### Explore
- `GET /api/explore/collections/:slug?cursor=` — «новые билды», «открытые коммишены» и т.д. как именованные подборки
- `GET /api/explore/search?q=&role=&status=&franchise=&country=`

### Commissions (публичная сторона)
- `GET /api/commissions/:username` — публичная страница коммишена мейкера
- `POST /api/commissions/:username/requests` — отправка заявки (может быть без авторизации — гостевая заявка с контактом email, см. схему `commission_requests.requester_user_id?`)

### Maker Studio (приватная зона)
- `GET /api/studio/orders?status=&cursor=` — доска заказов
- `PATCH /api/studio/orders/:id/status` — смена статуса (в т.ч. используется свайп-действием в приложении)
- `PATCH /api/studio/orders/:id/deposit` — отметить депозит оплаченным
- `GET /api/studio/orders/:id` — деталь заказа (чек-лист, заметки, шаблон договора)
- `PATCH /api/studio/orders/:id/checklist/:itemId`
- `GET /api/studio/calendar?from=&to=`
- `GET /api/studio/analytics` — базовая аналитика (кол-во заказов, средний чек, просрочки)
- `PATCH /api/studio/terms-template` — редактирование своего шаблона договора (specLegal.md §3)

### Credit & Consent
- `POST /api/credits/:photoId/confirm` — подтверждение тега (мейкер/фотограф подтверждает, что он причастен к фото)
- `POST /api/credits/:photoId/decline`

### Notifications
- `GET /api/notifications?cursor=`
- `PATCH /api/notifications/:id/read`
- `POST /api/notifications/register-push` — регистрация Expo push-токена устройства (только приложение)

## 4. Коды ошибок (не исчерпывающе, ключевые бизнес-кейсы)

| Код | Ситуация |
|---|---|
| `COMMISSION_CLOSED` | Попытка отправить заявку, когда коммишен закрыт |
| `CONSENT_PENDING` | Фото ещё не подтверждено второй стороной — не публикуется |
| `RATE_LIMITED` | Превышен лимит гостевых заявок с одного IP |
| `SUBSCRIPTION_REQUIRED` | Фича за фичефлагом подписки (см. specWEB.md §5) — заложено, но неактивно в MVP, пока `subscriptions`-проверка везде возвращает «доступно» |
| `MODERATION_HOLD` | Контент придержан модерацией (см. specModeration.md) — не виден публично до решения |

## 5. Rate limiting и антиспам

- Гостевая форма заявки на коммишен (`POST /api/commissions/:username/requests` без токена) — не более N заявок с одного IP за час
- Загрузка медиа — лимит размера файла и количества файлов за запрос, компрессия на клиенте перед отправкой (см. specAPP.md §2 «Медиа»)

## 6. Дальше по плану

1. ✅ Пустые/ошибочные состояния
2. ✅ Юридика
3. ✅ App icon / splash screen
4. ✅ API-контракт — этот документ
5. ⏭ NSFW-модерация
