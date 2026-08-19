import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { optionalAuth, AuthRequest } from "../middleware/auth";

const CATEGORIES = [
  { id: "all", name: "Все категории", slug: "all" },
  { id: "genshin-impact", name: "Genshin Impact", slug: "genshin-impact" },
  { id: "honkai-star-rail", name: "Honkai: Star Rail", slug: "honkai-star-rail" },
  { id: "nier-automata", name: "Nier: Automata", slug: "nier-automata" },
  { id: "league-of-legends", name: "League of Legends", slug: "league-of-legends" },
  { id: "vocaloid", name: "Vocaloid", slug: "vocaloid" },
  { id: "chainsaw-man", name: "Chainsaw Man", slug: "chainsaw-man" },
  { id: "demon-slayer", name: "Demon Slayer", slug: "demon-slayer" },
  { id: "jujutsu-kaisen", name: "Jujutsu Kaisen", slug: "jujutsu-kaisen" },
  { id: "overwatch", name: "Overwatch", slug: "overwatch" },
  { id: "other", name: "Другие", slug: "other" },
];

const router = Router();

router.get("/", optionalAuth, (req: AuthRequest, res) => {
  const q = String(req.query.q || "").toLowerCase().trim();
  const role = String(req.query.role || "");
  const category = String(req.query.category || "");
  const commission = String(req.query.commission || "");
  const sort = String(req.query.sort || "new");
  const priceMin = req.query.priceMin ? Number(req.query.priceMin) : null;
  const priceMax = req.query.priceMax ? Number(req.query.priceMax) : null;
  const limit = Math.min(Number(req.query.limit) || 24, 48);
  const cursor = Number(req.query.cursor) || 0;

  const users = db.select().from(schema.users).all();
  const userById = new Map(users.map((u) => [u.id, u]));
  const likes = req.userId
    ? db.select().from(schema.buildLikes).where(eq(schema.buildLikes.userId, req.userId)).all()
    : [];
  const liked = new Set(likes.map((l) => l.buildId));

  let rows = db.select().from(schema.builds).all().filter((b) => !b.hidden);
  const seedIds = new Set(["jinx", "raiden", "miku", "2b", "cloud", "yae", "makima", "albedo", "dva", "nezuko", "levi", "maria"]);
  rows = rows.filter((b) => Boolean(b.coverImageUrl) && !seedIds.has(b.id));

  if (q) {
    rows = rows.filter((b) => {
      const author = userById.get(b.userId)?.username || "";
      return [b.title, b.character, b.franchise, b.category, author, b.tagsJson]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }
  if (category && category !== "all") {
    rows = rows.filter((b) => b.category === category);
  }
  if (commission) {
    const set = new Set(commission.split(",").filter(Boolean));
    rows = rows.filter((b) => b.commissionStatus && set.has(b.commissionStatus));
  }
  if (priceMin != null) rows = rows.filter((b) => (b.price || 0) >= priceMin);
  if (priceMax != null) rows = rows.filter((b) => (b.price || 0) <= priceMax);
  if (role) {
    rows = rows.filter((b) => {
      const flags = userById.get(b.userId)?.roleFlags || "";
      return flags.includes(role);
    });
  }

  rows.sort((a, b) => {
    if (sort === "likes") return (b.likesCount || 0) - (a.likesCount || 0);
    if (sort === "comments") return (b.commentsCount || 0) - (a.commentsCount || 0);
    if (sort === "price_asc") return (a.price || 0) - (b.price || 0);
    if (sort === "price_desc") return (b.price || 0) - (a.price || 0);
    if (sort === "popular") return (b.likesCount || 0) + (b.commentsCount || 0) * 3 - ((a.likesCount || 0) + (a.commentsCount || 0) * 3);
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const total = rows.length;
  const page = rows.slice(cursor, cursor + limit);
  const data = page.map((b) => {
    const author = userById.get(b.userId);
    const profile = author
      ? db.select().from(schema.profiles).where(eq(schema.profiles.userId, author.id)).get()
      : null;
    const flags = (author?.roleFlags || "cosplayer").split(",")[0];
    return {
      id: b.id,
      title: b.title,
      character: b.character,
      franchise: b.franchise,
      author: author?.username,
      authorId: b.userId,
      authorAvatar: profile?.avatarUrl || null,
      coverImageUrl: b.coverImageUrl || null,
      isVerified: Boolean(profile?.isVerified),
      status: b.commissionStatus || "open",
      likesCount: b.likesCount || 0,
      commentsCount: b.commentsCount || 0,
      year: b.year,
      price: b.price || 0,
      currency: b.currency || "UZS",
      category: b.category,
      isLiked: liked.has(b.id),
      role: flags,
    };
  });

  const all = db.select().from(schema.builds).all().filter((b) => !b.hidden);
  const categories = CATEGORIES.map((c) => ({
    ...c,
    count:
      c.id === "all"
        ? all.length
        : all.filter((b) => b.category === c.id).length,
  }));
  const statuses = {
    open: all.filter((b) => b.commissionStatus === "open").length,
    waitlist: all.filter((b) => b.commissionStatus === "waitlist").length,
    closed: all.filter((b) => b.commissionStatus === "closed").length,
    none: all.filter((b) => !b.commissionStatus).length,
  };

  res.json({
    data,
    nextCursor: cursor + limit < total ? cursor + limit : null,
    total,
    categories,
    statuses,
  });
});

export default router;
