# ALTER — cosplay community prototype

A working prototype of the "Telegram-topic-channels, but built for cosplayers"
community layer for ALTER: familiar sidebar-of-topics layout (so people
coming from Telegram feel at home immediately) plus features Telegram
doesn't have natively.

## Stack (and why)

- **Backend:** Python 3, standard library only (`http.server`). No `pip
  install`, no build step — this sandbox has network access disabled, so
  anything requiring a package download wasn't an option, and it also means
  you can run this literally anywhere Python exists.
- **Storage:** a single `data.json` file, read/written on each request. Fine
  for a prototype and single-process demo; swap for Turso/SQLite when you
  move past prototyping (schema below maps 1:1 to tables).
- **Frontend:** one vanilla HTML/CSS/JS file, no framework, no build step.
  Talks to the backend via `fetch`.

This is intentionally the simplest stack that's still "real" — every button
in the UI hits a real API endpoint and persists to disk.

## What it demonstrates

Sidebar structure mirrors your reference screenshot (grouped topic channels:
Общалка, Правила, Мероприятия, Барахолка, Поиск сокосплееров, etc.) so
existing Telegram-community members recognize the shape immediately.

Features **beyond** what Telegram gives you:

1. **Structured posts per channel type** — an "Мероприятия" post has real
   `date`/`location` fields, "Барахолка" has `item`/`price`, "Поиск
   сокосплееров" has `role`/`fandom`. In Telegram these are just free text
   buried in a wall of messages; here they render as a distinct card and are
   filterable/structured data, not text you have to parse by eye.
2. **Reactions with counts** you can add to any message (Telegram topics
   don't have this at all).
3. **Read-only/moderator channels** (Правила, Чёрный список) enforced
   server-side, not just by convention.
4. **Member list with mini-profiles** (maker badge, bio, tags) — the seed of
   the "profile hub" concept from your spec — and **1:1 DMs launched
   directly from a member card**, which is exactly the "дом, не только
   инструмент" direction from your last message in the chat log.
5. **Cross-channel search** — Telegram topic search is per-chat and clunky;
   this searches every channel's messages at once.

None of this needed a login system to be worth testing, so auth is a
dropdown ("Вы вошли как: ...") — swap for real auth before this goes further
than a demo.

## How to run it

```bash
cd alter-prototype
python3 server.py
```

Then open **http://localhost:8000** in a browser. That's it — no install
step, no environment variables required.

To reset the demo data, delete `data.json` (it's regenerated from the seed
in `server.py` on next start) and restart the server.

## File map

```
alter-prototype/
  server.py          all backend logic + seed data (single file, ~300 lines)
  static/index.html  entire frontend (HTML+CSS+JS in one file)
  data.json           created on first run — your "database"
```

## API surface (for reference / future frontend rewrite)

| Method | Path                              | Purpose                          |
|--------|------------------------------------|-----------------------------------|
| GET    | `/api/channels`                    | list channels + category/type     |
| GET    | `/api/channels/:id/messages`       | messages in a channel             |
| POST   | `/api/channels/:id/messages`       | post a message (+ optional `meta`)|
| POST   | `/api/messages/:id/react`          | add a reaction                    |
| GET    | `/api/users` / `/api/users/:id`    | member list / profile             |
| GET    | `/api/search?q=`                   | search across all channel messages|
| GET    | `/api/dms/:userId?me=`             | DM thread with a user             |
| POST   | `/api/dms/:userId`                 | send a DM                         |

## What I'd extend first

Roughly in priority order, matching what would actually block you from
onboarding real cosplayers vs. what's a nice-to-have:

1. **Real auth + per-user identity.** Right now "who you are" is a
   dropdown. Swap in actual accounts (email/Telegram OAuth is a natural fit
   given your audience already lives there) before anyone but you touches
   this.
2. **Move `data.json` → Turso/SQLite.** The JSON-file store is single-writer
   and will corrupt under concurrent writes. The schema already matches
   `users` / `channels` / `messages` / `dms` tables almost directly, so this
   is a mechanical port, not a redesign.
3. **Report/block + spam throttling on DMs**, per your own spec's point 9 —
   this was flagged as non-optional for launch, not a "later" feature,
   specifically because personal messaging is where harassment risk
   concentrates.
4. **Thematic sub-channels that scale** — franchise/fandom and
   city/convention channels, generated from tags people already have on
   their profile, so a new user's sidebar isn't one giant flat list once you
   have hundreds of topics.
5. **Real-time updates** (WebSocket or polling) instead of "refetch on
   action" — right now two people in the same channel don't see each
   other's messages without reloading.
6. **Image support** in messages — this is a visual hobby; a text-only chat
   undersells the product. The `meta` field structure already gives you a
   place to hang a `photo_url`.
7. **Push notifications** for DMs and replies once this is a real app people
   installed rather than a browser tab.

None of these are architecture changes — the message/channel model and the
`meta`-per-type pattern were built so each of these slots in without a
rewrite.
