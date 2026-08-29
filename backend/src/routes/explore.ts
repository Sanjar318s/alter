import { Router } from "express";
import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  like,
  lte,
  ne,
  notInArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { db, schema } from "../db";
import { optionalAuth, AuthRequest } from "../middleware/auth";
import { getCached, publicCacheHeaders, setCached } from "../lib/shortCache";

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

const SEED_IDS = [
  "jinx",
  "raiden",
  "miku",
  "2b",
  "cloud",
  "yae",
  "makima",
  "albedo",
  "dva",
  "nezuko",
  "levi",
  "maria",
];

const router = Router();
const TTL = 45_000;
const FACET_TTL = 120_000;

function orderFor(sort: string) {
  if (sort === "likes") return desc(schema.builds.likesCount);
  if (sort === "comments") return desc(schema.builds.commentsCount);
  if (sort === "price_asc") return schema.builds.price;
  if (sort === "price_desc") return desc(schema.builds.price);
  if (sort === "popular") {
    return sql`(${schema.builds.likesCount} + ${schema.builds.commentsCount} * 3) DESC`;
  }
  return desc(schema.builds.createdAt);
}

function buildWhere(opts: {
  q: string;
  role: string;
  category: string;
  commission: string;
  priceMin: number | null;
  priceMax: number | null;
}): SQL | undefined {
  const parts: SQL[] = [
    eq(schema.builds.hidden, false),
    isNotNull(schema.builds.coverImageUrl),
    ne(schema.builds.coverImageUrl, ""),
    notInArray(schema.builds.id, SEED_IDS),
  ];

  if (opts.category && opts.category !== "all") {
    parts.push(eq(schema.builds.category, opts.category));
  }
  if (opts.commission) {
    const set = opts.commission.split(",").filter(Boolean);
    if (set.length === 1) parts.push(eq(schema.builds.commissionStatus, set[0]));
    else if (set.length > 1) parts.push(inArray(schema.builds.commissionStatus, set));
  }
  if (opts.priceMin != null) parts.push(gte(schema.builds.price, opts.priceMin));
  if (opts.priceMax != null) parts.push(lte(schema.builds.price, opts.priceMax));
  if (opts.role) {
    const safeRole = opts.role.replace(/[^a-z0-9_-]/gi, "").slice(0, 32);
    if (safeRole) parts.push(like(schema.users.roleFlags, `%${safeRole}%`));
  }
  if (opts.q) {
    const safeQ = opts.q.replace(/[%_]/g, "").slice(0, 80);
    if (safeQ) {
      const pat = `%${safeQ}%`;
      parts.push(
        or(
          like(schema.builds.title, pat),
          like(schema.builds.character, pat),
          like(schema.builds.franchise, pat),
          like(schema.builds.category, pat),
          like(schema.builds.tagsJson, pat),
          like(schema.users.username, pat)
        )!
      );
    }
  }
  return and(...parts);
}

function loadFacets() {
  const cached = getCached<{
    categories: typeof CATEGORIES & { count: number }[];
    statuses: Record<string, number>;
  }>("explore:facets", FACET_TTL);
  if (cached) return cached;

  const rows = db
    .select({
      category: schema.builds.category,
      commissionStatus: schema.builds.commissionStatus,
    })
    .from(schema.builds)
    .where(
      and(
        eq(schema.builds.hidden, false),
        isNotNull(schema.builds.coverImageUrl),
        ne(schema.builds.coverImageUrl, ""),
        notInArray(schema.builds.id, SEED_IDS)
      )
    )
    .all();

  const categories = CATEGORIES.map((c) => ({
    ...c,
    count:
      c.id === "all"
        ? rows.length
        : rows.filter((b) => b.category === c.id).length,
  }));
  const statuses = {
    open: rows.filter((b) => b.commissionStatus === "open").length,
    waitlist: rows.filter((b) => b.commissionStatus === "waitlist").length,
    closed: rows.filter((b) => b.commissionStatus === "closed").length,
    none: rows.filter((b) => !b.commissionStatus).length,
  };
  const payload = { categories, statuses };
  setCached("explore:facets", payload);
  return payload;
}

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
  const anon = !req.userId;

  const cacheKey = anon
    ? `explore:v2:${q}|${role}|${category}|${commission}|${sort}|${priceMin}|${priceMax}|${limit}|${cursor}`
    : null;

  if (cacheKey) {
    const hit = getCached<unknown>(cacheKey, TTL);
    if (hit) {
      publicCacheHeaders(res, 45);
      return res.json(hit);
    }
  }

  const where = buildWhere({ q, role, category, commission, priceMin, priceMax });

  const countRow = db
    .select({ total: sql<number>`count(*)` })
    .from(schema.builds)
    .innerJoin(schema.users, eq(schema.builds.userId, schema.users.id))
    .where(where)
    .get();
  const total = Number(countRow?.total || 0);

  const page = db
    .select({
      id: schema.builds.id,
      title: schema.builds.title,
      character: schema.builds.character,
      franchise: schema.builds.franchise,
      userId: schema.builds.userId,
      coverImageUrl: schema.builds.coverImageUrl,
      likesCount: schema.builds.likesCount,
      commentsCount: schema.builds.commentsCount,
      year: schema.builds.year,
      price: schema.builds.price,
      currency: schema.builds.currency,
      category: schema.builds.category,
      commissionStatus: schema.builds.commissionStatus,
      username: schema.users.username,
      roleFlags: schema.users.roleFlags,
      avatarUrl: schema.profiles.avatarUrl,
      isVerified: schema.profiles.isVerified,
    })
    .from(schema.builds)
    .innerJoin(schema.users, eq(schema.builds.userId, schema.users.id))
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
    .where(where)
    .orderBy(orderFor(sort))
    .limit(limit)
    .offset(cursor)
    .all();

  const liked = new Set<string>();
  if (req.userId && page.length) {
    const likes = db
      .select({ buildId: schema.buildLikes.buildId })
      .from(schema.buildLikes)
      .where(
        and(
          eq(schema.buildLikes.userId, req.userId),
          inArray(
            schema.buildLikes.buildId,
            page.map((p) => p.id)
          )
        )
      )
      .all();
    for (const l of likes) liked.add(l.buildId);
  }

  const data = page.map((b) => {
    const flags = (b.roleFlags || "cosplayer").split(",")[0];
    return {
      id: b.id,
      title: b.title,
      character: b.character,
      franchise: b.franchise,
      author: b.username,
      authorId: b.userId,
      authorAvatar: b.avatarUrl || null,
      coverImageUrl: b.coverImageUrl || null,
      isVerified: Boolean(b.isVerified),
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

  const facets = loadFacets();
  const payload = {
    data,
    nextCursor: cursor + limit < total ? cursor + limit : null,
    total,
    categories: facets.categories,
    statuses: facets.statuses,
  };

  if (cacheKey) {
    setCached(cacheKey, payload);
    publicCacheHeaders(res, 45);
  } else {
    res.setHeader("Cache-Control", "private, no-store");
  }

  res.json(payload);
});

export default router;
