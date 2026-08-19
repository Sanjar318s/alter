#!/usr/bin/env python3
"""
ALTER Community — prototype backend.

Pure Python standard library (http.server). No pip installs needed.
Data is persisted to data.json (created from seed_data() on first run).

Run:
    python3 server.py
Then open http://localhost:8000
"""

import json
import os
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

DB_PATH = os.path.join(os.path.dirname(__file__), "data.json")
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")


# ---------------------------------------------------------------------------
# Seed data — mirrors the structure of a real Telegram cosplay community
# (topics like Общалка / Мероприятия / Барахолка / Поиск сокосплееров),
# but organized into categories and given structured fields per channel type.
# ---------------------------------------------------------------------------
def seed_data():
    users = [
        {"id": "u1", "username": "Максим Николаевич", "avatar": "🐺", "bio": "Genshin & Arknights cosplay. Tashkent.", "tags": ["genshin", "arknights"], "maker": False},
        {"id": "u2", "username": "Любовь Моя", "avatar": "🦋", "bio": "Швея-мейкер, заказы открыты.", "tags": ["seamstress", "props"], "maker": True},
        {"id": "u3", "username": "Ксения", "avatar": "🎀", "bio": "Коллекционирую мерч, ищу редкости.", "tags": ["merch"], "maker": False},
        {"id": "u4", "username": "Джайро", "avatar": "🖋️", "bio": "Гайды по гриму и парикам.", "tags": ["wig", "makeup"], "maker": True},
        {"id": "you", "username": "Вы", "avatar": "🙂", "bio": "Новый участник ALTER.", "tags": [], "maker": False},
    ]

    channels = [
        {"id": "general", "name": "Общалка", "icon": "💬", "category": "Общение", "type": "general",
         "description": "Свободное общение обо всём.", "pinned": False},
        {"id": "rules", "name": "Правила", "icon": "❗", "category": "Общение", "type": "general",
         "description": "Как быть хорошим косплеером и не попасть в бан.", "pinned": True, "locked": True},

        {"id": "events", "name": "Мероприятия", "icon": "📅", "category": "Мероприятия и услуги", "type": "event",
         "description": "Конвенты, фесты, фотосессии — с датой и местом.", "pinned": False},
        {"id": "services", "name": "Услуги", "icon": "🛠️", "category": "Мероприятия и услуги", "type": "service",
         "description": "Фотографы, гримёры, мейкеры предлагают услуги.", "pinned": False},

        {"id": "market", "name": "Барахолка", "icon": "💰", "category": "Барахолка и аренда", "type": "market",
         "description": "Купля-продажа костюмов и реквизита — с ценой.", "pinned": False},
        {"id": "rental", "name": "Аренда костюмов", "icon": "⭐", "category": "Барахолка и аренда", "type": "market",
         "description": "Аренда костюмов и кроплея.", "pinned": False},

        {"id": "cosplays", "name": "Ваши косплеи", "icon": "🐈", "category": "Творчество", "type": "gallery",
         "description": "Показывайте свои готовые образы.", "pinned": False},
        {"id": "art", "name": "Ваши рисунки", "icon": "🎨", "category": "Творчество", "type": "gallery",
         "description": "Фан-арт и скетчи.", "pinned": False},
        {"id": "guides", "name": "Заметки и гайды", "icon": "📝", "category": "Творчество", "type": "general",
         "description": "Гайды по пошиву, гриму, фотографии.", "pinned": False},

        {"id": "find-cosplayer", "name": "Поиск сокосплееров", "icon": "🔍", "category": "Поиск", "type": "search",
         "description": "Ищете напарника на групповой косплей — укажите роль и фандом.", "pinned": False},
        {"id": "blacklist", "name": "Чёрный список", "icon": "❗", "category": "Поиск", "type": "general",
         "description": "Предупреждения о недобросовестных мейкерах/покупателях.", "pinned": True, "locked": True},
    ]

    messages = [
        {"id": str(uuid.uuid4()), "channel_id": "general", "author_id": "u1",
         "text": "Всем привет! Кто едет на конец недели на встречу в парке?", "ts": time.time() - 3600,
         "reactions": {"🔥": 3}, "meta": {}},
        {"id": str(uuid.uuid4()), "channel_id": "events", "author_id": "u4",
         "text": "Comic Con Tashkent, 15–16 августа, 14:30–20:00, D&D Club UZ", "ts": time.time() - 7200,
         "reactions": {"❤️": 5}, "meta": {"date": "2026-08-15", "location": "D&D Club UZ, Tashkent"}},
        {"id": str(uuid.uuid4()), "channel_id": "market", "author_id": "u3",
         "text": "Продам парик Раден Сайонджи, почти новый", "ts": time.time() - 5400,
         "reactions": {}, "meta": {"price": "250 000 сум", "item": "Парик"}},
        {"id": str(uuid.uuid4()), "channel_id": "find-cosplayer", "author_id": "u1",
         "text": "Ищу человека на роль Аяки для групповой съёмки в сентябре", "ts": time.time() - 1800,
         "reactions": {"🙋": 2}, "meta": {"role": "Аяка", "fandom": "Genshin Impact", "date": "2026-09-01"}},
        {"id": str(uuid.uuid4()), "channel_id": "cosplays", "author_id": "u2",
         "text": "Закончила костюм Джинкс, фото после конвента!", "ts": time.time() - 900,
         "reactions": {"🔥": 8, "❤️": 4}, "meta": {}},
    ]

    dms = []  # list of {id, participants:[a,b], messages:[{author_id, text, ts}]}

    return {"users": users, "channels": channels, "messages": messages, "dms": dms}


def load_db():
    if not os.path.exists(DB_PATH):
        db = seed_data()
        save_db(db)
        return db
    with open(DB_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_db(db):
    with open(DB_PATH, "w", encoding="utf-8") as f:
        json.dump(db, f, ensure_ascii=False, indent=2)


def user_by_id(db, uid):
    return next((u for u in db["users"] if u["id"] == uid), None)


def enrich_message(db, m):
    author = user_by_id(db, m["author_id"]) or {"username": "?", "avatar": "❓"}
    out = dict(m)
    out["author_name"] = author["username"]
    out["author_avatar"] = author["avatar"]
    out["author_maker"] = author.get("maker", False)
    return out


# ---------------------------------------------------------------------------
# HTTP handler
# ---------------------------------------------------------------------------
class Handler(BaseHTTPRequestHandler):
    def _send_json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json_body(self):
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return {}
        raw = self.rfile.read(length)
        return json.loads(raw.decode("utf-8"))

    def _serve_static(self, path):
        if path == "/" or path == "":
            path = "/index.html"
        fs_path = os.path.join(STATIC_DIR, path.lstrip("/"))
        if not os.path.abspath(fs_path).startswith(os.path.abspath(STATIC_DIR)):
            self.send_error(403)
            return
        if not os.path.isfile(fs_path):
            self.send_error(404)
            return
        ctype = "text/html; charset=utf-8"
        if fs_path.endswith(".js"):
            ctype = "application/javascript; charset=utf-8"
        elif fs_path.endswith(".css"):
            ctype = "text/css; charset=utf-8"
        with open(fs_path, "rb") as f:
            body = f.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    # -- GET ------------------------------------------------------------
    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)
        db = load_db()

        if path == "/api/channels":
            self._send_json(db["channels"])
            return

        if path.startswith("/api/channels/") and path.endswith("/messages"):
            chan_id = path.split("/")[3]
            msgs = [enrich_message(db, m) for m in db["messages"] if m["channel_id"] == chan_id]
            msgs.sort(key=lambda m: m["ts"])
            self._send_json(msgs)
            return

        if path == "/api/users":
            self._send_json(db["users"])
            return

        if path.startswith("/api/users/"):
            uid = path.split("/")[3]
            u = user_by_id(db, uid)
            if not u:
                self._send_json({"error": "not found"}, 404)
                return
            self._send_json(u)
            return

        if path == "/api/search":
            q = (qs.get("q", [""])[0] or "").strip().lower()
            results = []
            if q:
                for m in db["messages"]:
                    if q in m["text"].lower():
                        results.append(enrich_message(db, m))
            self._send_json(results)
            return

        if path.startswith("/api/dms/"):
            # /api/dms/<other_user_id>?me=<my_id>
            other = path.split("/")[3]
            me = qs.get("me", ["you"])[0]
            key = tuple(sorted([me, other]))
            thread = next((d for d in db["dms"] if tuple(sorted(d["participants"])) == key), None)
            if not thread:
                self._send_json([])
                return
            out = []
            for m in thread["messages"]:
                author = user_by_id(db, m["author_id"]) or {"username": "?", "avatar": "❓"}
                out.append({**m, "author_name": author["username"], "author_avatar": author["avatar"]})
            self._send_json(out)
            return

        # static files (frontend)
        self._serve_static(path)

    # -- POST -----------------------------------------------------------
    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        db = load_db()
        body = self._read_json_body()

        if path.startswith("/api/channels/") and path.endswith("/messages"):
            chan_id = path.split("/")[3]
            channel = next((c for c in db["channels"] if c["id"] == chan_id), None)
            if not channel:
                self._send_json({"error": "channel not found"}, 404)
                return
            if channel.get("locked"):
                self._send_json({"error": "channel is read-only"}, 403)
                return
            msg = {
                "id": str(uuid.uuid4()),
                "channel_id": chan_id,
                "author_id": body.get("author_id", "you"),
                "text": body.get("text", "").strip(),
                "ts": time.time(),
                "reactions": {},
                "meta": body.get("meta", {}),
            }
            if not msg["text"]:
                self._send_json({"error": "empty message"}, 400)
                return
            db["messages"].append(msg)
            save_db(db)
            self._send_json(enrich_message(db, msg), 201)
            return

        if path.startswith("/api/messages/") and path.endswith("/react"):
            msg_id = path.split("/")[3]
            emoji = body.get("emoji", "👍")
            m = next((m for m in db["messages"] if m["id"] == msg_id), None)
            if not m:
                self._send_json({"error": "message not found"}, 404)
                return
            m["reactions"][emoji] = m["reactions"].get(emoji, 0) + 1
            save_db(db)
            self._send_json(m)
            return

        if path.startswith("/api/dms/"):
            other = path.split("/")[3]
            me = body.get("me", "you")
            text = body.get("text", "").strip()
            if not text:
                self._send_json({"error": "empty message"}, 400)
                return
            key = tuple(sorted([me, other]))
            thread = next((d for d in db["dms"] if tuple(sorted(d["participants"])) == key), None)
            if not thread:
                thread = {"id": str(uuid.uuid4()), "participants": [me, other], "messages": []}
                db["dms"].append(thread)
            msg = {"author_id": me, "text": text, "ts": time.time()}
            thread["messages"].append(msg)
            save_db(db)
            self._send_json(msg, 201)
            return

        self._send_json({"error": "not found"}, 404)

    def log_message(self, format, *args):
        pass  # quiet logs


def main():
    port = int(os.environ.get("PORT", 8000))
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"ALTER prototype running → http://localhost:{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
