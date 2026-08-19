import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { db, schema } from "./index";
import { ADMIN_USERNAME } from "../lib/owner";

const HASH = bcrypt.hashSync("alter123", 8);

type DemoUser = {
  id: string;
  email: string;
  username: string;
  roleFlags: string;
  displayName: string;
  bio: string;
  city: string;
  country: string;
  commissionStatus: string;
  isVerified: boolean;
  links: Record<string, string>;
  events: { date: string; name: string; city: string }[];
  extra?: Partial<typeof schema.profiles.$inferInsert>;
};

const USERS: DemoUser[] = [
  {
    id: "u-nyx",
    email: "demo.nyx@alter.local",
    username: "demo.nyx",
    roleFlags: "cosplayer,maker",
    displayName: "Nyx",
    bio: "Косплеер и мейкер. Корсеты, лёгкий армор, Inazuma-эстетика. Открыта к совместным билдам.",
    city: "Москва",
    country: "Россия",
    commissionStatus: "open",
    isVerified: true,
    links: { instagram: "https://instagram.com/nyx.cosplay", telegram: "https://t.me/nyxcosplay" },
    events: [
      { date: "2026-06-15", name: "CosFest", city: "Москва" },
      { date: "2026-08-22", name: "AniCon", city: "Санкт-Петербург" },
    ],
    extra: {
      commissionComplexity: "Средняя–высокая",
      commissionTypes: "Костюмы, корсеты, парики",
      commissionDuration: "3–6 недель",
      priceMin: 350000,
      priceMax: 1200000,
      languagesJson: JSON.stringify(["ru", "en"]),
      specializationsJson: JSON.stringify(["корсеты", "wig styling", "armor"]),
      availability: "open",
      maxActiveOrders: 4,
    },
  },
  {
    id: "u-luna",
    email: "luna@alter.local",
    username: "luna.s",
    roleFlags: "cosplayer",
    displayName: "Luna",
    bio: "Косплеер. Genshin, Honkai, вокал на конвентах. Ищу мейкеров на сложный армор.",
    city: "Ташкент",
    country: "Узбекистан",
    commissionStatus: "waitlist",
    isVerified: true,
    links: { instagram: "https://instagram.com/luna.s", tiktok: "https://tiktok.com/@luna.s" },
    events: [{ date: "2026-09-14", name: "CosFest Tashkent", city: "Ташкент" }],
  },
  {
    id: "u-victor",
    email: "victor@alter.local",
    username: "victor.maker",
    roleFlags: "maker",
    displayName: "Victor",
    bio: "Ателье: EVA, 3D-печать, сложные шлемы.",
    city: "Алматы",
    country: "Казахстан",
    commissionStatus: "open",
    isVerified: true,
    links: { instagram: "https://instagram.com/victor.maker" },
    events: [],
  },
  {
    id: "u-raiden",
    email: "raiden@alter.local",
    username: "raiden.photo",
    roleFlags: "photographer",
    displayName: "Raiden Photo",
    bio: "Снимаю косплей: студия и пленэр. Тег автора на каждом кадре.",
    city: "Москва",
    country: "Россия",
    commissionStatus: "closed",
    isVerified: true,
    links: { instagram: "https://instagram.com/raiden.photo" },
    events: [],
  },
];

const BUILDS = [
  { id: "jinx", userId: "u-nyx", title: "Jinx", character: "JINX", franchise: "LEAGUE OF LEGENDS", category: "league-of-legends", year: 2024, price: 450000, likes: 1200, comments: 23, status: "open" },
  { id: "raiden", userId: "u-luna", title: "Raiden Shogun", character: "RAIDEN SHOGUN", franchise: "GENSHIN IMPACT", category: "genshin-impact", year: 2025, price: 800000, likes: 1800, comments: 42, status: "open" },
  { id: "miku", userId: "u-nyx", title: "Miku", character: "MIKU", franchise: "VOCALOID", category: "vocaloid", year: 2024, price: 200000, likes: 2300, comments: 35, status: "open" },
  { id: "2b", userId: "u-raiden", title: "2B", character: "2B", franchise: "NIER: AUTOMATA", category: "nier-automata", year: 2025, price: 620000, likes: 980, comments: 18, status: "waitlist" },
  { id: "cloud", userId: "u-victor", title: "Cloud Strife", character: "CLOUD STRIFE", franchise: "FINAL FANTASY VII", category: "other", year: 2023, price: 700000, likes: 1600, comments: 31, status: "open" },
  { id: "yae", userId: "u-luna", title: "Yae Miko", character: "YAE MIKO", franchise: "GENSHIN IMPACT", category: "genshin-impact", year: 2025, price: 900000, likes: 1100, comments: 27, status: "waitlist" },
  { id: "makima", userId: "u-nyx", title: "Makima", character: "MAKIMA", franchise: "CHAINSAW MAN", category: "chainsaw-man", year: 2024, price: 0, likes: 740, comments: 12, status: "closed" },
  { id: "albedo", userId: "u-luna", title: "Albedo", character: "ALBEDO", franchise: "GENSHIN IMPACT", category: "genshin-impact", year: 2025, price: 550000, likes: 890, comments: 19, status: "open" },
  { id: "dva", userId: "u-victor", title: "D.Va", character: "D.VA", franchise: "OVERWATCH", category: "overwatch", year: 2024, price: 380000, likes: 1320, comments: 28, status: "open" },
  { id: "nezuko", userId: "u-nyx", title: "Nezuko", character: "NEZUKO KAMADO", franchise: "DEMON SLAYER", category: "demon-slayer", year: 2023, price: 420000, likes: 1540, comments: 22, status: "open" },
  { id: "levi", userId: "u-victor", title: "Levi", character: "LEVI ACKERMAN", franchise: "ATTACK ON TITAN", category: "other", year: 2022, price: 0, likes: 610, comments: 9, status: "closed" },
  { id: "maria", userId: "u-nyx", title: "Lady Maria", character: "LADY MARIA", franchise: "BLOODBORNE", category: "other", year: 2025, price: 1100000, likes: 870, comments: 15, status: "waitlist" },
];

/** Owner nick is reserved for a fresh signup — park whoever currently holds it. */
function releaseOwnerNick() {
  const occupied = db.select().from(schema.users).where(eq(schema.users.username, ADMIN_USERNAME)).get();
  if (!occupied) return;
  // Never rename real user accounts during seed.
  // We only migrate legacy demo owner account to free ADMIN_USERNAME.
  const isLegacyDemo =
    occupied.id === "u-nyx" ||
    occupied.email === "nyx@alter.local" ||
    occupied.email === "demo.nyx@alter.local";
  if (!isLegacyDemo) return;
  const preferred = occupied.id === "u-nyx" ? "demo.nyx" : `parked.${occupied.id.slice(0, 8)}`;
  const clash = db.select().from(schema.users).where(eq(schema.users.username, preferred)).get();
  const nextName =
    clash && clash.id !== occupied.id ? `parked.${occupied.id.replace(/-/g, "").slice(0, 12)}` : preferred;
  const flags = (occupied.roleFlags || "cosplayer")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && s !== "admin");
  db.update(schema.users)
    .set({
      username: nextName,
      email: occupied.email === "nyx@alter.local" ? "demo.nyx@alter.local" : occupied.email,
      roleFlags: flags.join(",") || "cosplayer",
    })
    .where(eq(schema.users.id, occupied.id))
    .run();
}

export function seed() {
  if (process.env.SEED_DEMO !== "1") return;

  releaseOwnerNick();

  for (const u of USERS) {
    const existing =
      db.select().from(schema.users).where(eq(schema.users.id, u.id)).get() ||
      db.select().from(schema.users).where(eq(schema.users.username, u.username)).get() ||
      db.select().from(schema.users).where(eq(schema.users.email, u.email)).get();
    if (!existing) {
      db.insert(schema.users)
        .values({
          id: u.id,
          email: u.email,
          username: u.username,
          passwordHash: HASH,
          roleFlags: u.roleFlags,
        })
        .run();
    } else {
      const patch: { roleFlags: string; username?: string; email?: string } = { roleFlags: u.roleFlags };
      if (existing.id === u.id) {
        if (existing.username !== u.username) patch.username = u.username;
        if (existing.email !== u.email) patch.email = u.email;
      }
      db.update(schema.users).set(patch).where(eq(schema.users.id, existing.id)).run();
    }
    const userId = existing?.id || u.id;
    const profile = db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId)).get();
    const payload = {
      userId,
      displayName: u.displayName,
      bio: u.bio,
      city: u.city,
      country: u.country,
      commissionStatus: u.commissionStatus,
      isVerified: u.isVerified,
      lastSeen: new Date(),
      linksJson: JSON.stringify(u.links),
      eventsJson: JSON.stringify(u.events),
      ...u.extra,
    };
    if (!profile) {
      db.insert(schema.profiles).values(payload).run();
    } else {
      db.update(schema.profiles).set(payload).where(eq(schema.profiles.userId, userId)).run();
    }
  }

  for (const b of BUILDS) {
    const exists = db.select().from(schema.builds).where(eq(schema.builds.id, b.id)).get();
    const row = {
      id: b.id,
      userId: b.userId,
      title: b.title,
      character: b.character,
      franchise: b.franchise,
      category: b.category,
      year: b.year,
      price: b.price,
      currency: "UZS",
      likesCount: b.likes,
      commentsCount: b.comments,
      commissionStatus: b.status,
      hidden: true,
    };
    if (!exists) db.insert(schema.builds).values(row).run();
  }
  for (const b of BUILDS) {
    const row = db.select().from(schema.builds).where(eq(schema.builds.id, b.id)).get();
    if (row && !row.coverImageUrl) {
      db.update(schema.builds).set({ hidden: true }).where(eq(schema.builds.id, b.id)).run();
    }
  }

  const comm = db.select().from(schema.commissions).where(eq(schema.commissions.id, "comm-nyx")).get();
  if (!comm) {
    db.insert(schema.commissions)
      .values({
        id: "comm-nyx",
        makerId: "u-nyx",
        title: "Пошив костюма",
        description: "Полный костюм под ключ",
        priceFrom: 450000,
        turnaroundDays: 28,
        status: "open",
      })
      .run();
  }

  const orders = [
    { id: "ord-raiden", title: "RAIDEN 2.5", character: "RAIDEN SHOGUN", franchise: "GENSHIN IMPACT", status: "in_progress", client: "u-luna", budget: 800000, deposit: 240000, paid: 240000, days: 12 },
    { id: "ord-yae", title: "YAE MIKO", character: "YAE MIKO", franchise: "GENSHIN IMPACT", status: "fitting", client: "u-luna", budget: 900000, deposit: 270000, paid: 270000, days: 20 },
    { id: "ord-2b", title: "2B", character: "2B", franchise: "NIER: AUTOMATA", status: "done", client: "u-raiden", budget: 620000, deposit: 186000, paid: 620000, days: -3 },
    { id: "ord-jinx", title: "JINX", character: "JINX", franchise: "LEAGUE OF LEGENDS", status: "discussion", client: "u-luna", budget: 450000, deposit: 0, paid: 0, days: 30 },
    { id: "ord-dva", title: "D.VA", character: "D.VA", franchise: "OVERWATCH", status: "shipped", client: "u-victor", budget: 380000, deposit: 114000, paid: 380000, days: -14 },
    { id: "ord-miku", title: "MIKU", character: "MIKU", franchise: "VOCALOID", status: "archive", client: "u-luna", budget: 200000, deposit: 60000, paid: 200000, days: -40 },
  ];

  for (const o of orders) {
    const reqId = `req-${o.id}`;
    if (!db.select().from(schema.commissionRequests).where(eq(schema.commissionRequests.id, reqId)).get()) {
      db.insert(schema.commissionRequests)
        .values({
          id: reqId,
          commissionId: "comm-nyx",
          requesterUserId: o.client,
          status: "accepted",
        })
        .run();
    }
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + o.days);
    const checklist = [
      { id: "1", label: "Замеры", done: true },
      { id: "2", label: "Депозит", done: o.paid > 0 },
      { id: "3", label: "Крой", done: ["in_progress", "fitting", "done", "shipped", "archive"].includes(o.status) },
      { id: "4", label: "Примерка", done: ["fitting", "done", "shipped", "archive"].includes(o.status) },
      { id: "5", label: "Отправка", done: ["shipped", "archive"].includes(o.status) },
    ];
    const row = {
      id: o.id,
      commissionRequestId: reqId,
      makerId: "u-nyx",
      status: o.status,
      title: o.title,
      character: o.character,
      franchise: o.franchise,
      clientId: o.client,
      budget: o.budget,
      depositAmount: o.deposit,
      depositPaid: o.deposit > 0,
      paidAmount: o.paid,
      remainingAmount: o.budget - o.paid,
      deadline,
      notes: "Клиент просил усилить посадку корсета.",
      checklistJson: JSON.stringify(checklist),
      activityJson: JSON.stringify([{ at: new Date().toISOString(), text: "Заказ создан" }]),
      filesJson: "[]",
    };
    if (!db.select().from(schema.orders).where(eq(schema.orders.id, o.id)).get()) {
      db.insert(schema.orders).values(row).run();
    }
  }

  const convId = "conv-nyx-luna";
  if (!db.select().from(schema.conversations).where(eq(schema.conversations.id, convId)).get()) {
    db.insert(schema.conversations).values({ id: convId, type: "dm" }).run();
    db.insert(schema.conversationMembers).values({ conversationId: convId, userId: "u-nyx", role: "member" }).run();
    db.insert(schema.conversationMembers).values({ conversationId: convId, userId: "u-luna", role: "member" }).run();
    const msgs = [
      { id: "m1", senderId: "u-luna", text: "Привет! Можно ли взять Raiden 2.5 на CosFest?", type: "text" },
      { id: "m2", senderId: "u-nyx", text: "Да, слоты ещё есть. Скинь замеры и референсы.", type: "text" },
      { id: "m3", senderId: "u-luna", text: "Голосовое сообщение", type: "voice", duration: 7 },
      { id: "m4", senderId: "u-nyx", text: "Приняла, начинаем крой на следующей неделе.", type: "text" },
    ];
    for (const m of msgs) {
      db.insert(schema.messages)
        .values({
          id: m.id,
          conversationId: convId,
          senderId: m.senderId,
          text: m.text,
          type: m.type,
          duration: "duration" in m ? m.duration : null,
          status: "sent",
        })
        .run();
    }
  }

  const chConv = "conv-ch-genshin";
  if (!db.select().from(schema.conversations).where(eq(schema.conversations.id, chConv)).get()) {
    db.insert(schema.conversations).values({ id: chConv, type: "channel" }).run();
    db.insert(schema.channels)
      .values({
        id: "ch-genshin",
        conversationId: chConv,
        kind: "franchise",
        title: "Genshin Impact",
        relatedFranchise: "Genshin Impact",
      })
      .run();
    db.insert(schema.conversationMembers).values({ conversationId: chConv, userId: "u-nyx", role: "owner" }).run();
  }

  if (!db.select().from(schema.follows).where(eq(schema.follows.followerId, "u-luna")).get()) {
    db.insert(schema.follows).values({ followerId: "u-luna", followingId: "u-nyx" }).run();
  }

  const demoPosts = [
    {
      id: "pub-1",
      caption: "Raiden 2.5 финальная примерка перед CosFest #genshin #raiden @luna.s",
      mediaJson: JSON.stringify(["raiden-final"]),
      tagsJson: JSON.stringify(["genshin", "raiden", "cosfest"]),
      likesCount: 142,
      commentsCount: 18,
    },
    {
      id: "pub-2",
      caption: "Jinx wig styling WIP — красим прядями #arcane #jinx",
      mediaJson: JSON.stringify(["jinx-wig"]),
      tagsJson: JSON.stringify(["arcane", "jinx"]),
      likesCount: 89,
      commentsCount: 7,
    },
    {
      id: "pub-3",
      caption: "Backstage CosFest с @raiden.photo",
      mediaJson: JSON.stringify(["backstage-1", "backstage-2"]),
      tagsJson: JSON.stringify(["cosfest", "backstage"]),
      likesCount: 256,
      commentsCount: 31,
    },
    {
      id: "pub-4",
      caption: "Корсетная сетка — процесс #maker #corset",
      mediaJson: JSON.stringify(["corset-wip"]),
      tagsJson: JSON.stringify(["maker", "corset"]),
      likesCount: 67,
      commentsCount: 5,
    },
    {
      id: "pub-5",
      caption: "Honkai meetup — спасибо всем! #honkai",
      mediaJson: JSON.stringify(["honkai-meet"]),
      tagsJson: JSON.stringify(["honkai"]),
      likesCount: 198,
      commentsCount: 22,
    },
    {
      id: "pub-6",
      caption: "Новый билд в работе — Yae Miko teaser #genshin",
      mediaJson: JSON.stringify(["yae-teaser"]),
      tagsJson: JSON.stringify(["genshin", "yaemiko"]),
      likesCount: 312,
      commentsCount: 44,
    },
  ];

  for (const p of demoPosts) {
    if (!db.select().from(schema.publications).where(eq(schema.publications.id, p.id)).get()) {
      db.insert(schema.publications)
        .values({
          id: p.id,
          userId: "u-nyx",
          caption: p.caption,
          mediaJson: p.mediaJson,
          tagsJson: p.tagsJson,
          kind: "post",
          likesCount: p.likesCount,
          commentsCount: p.commentsCount,
        })
        .run();
    }
  }

  const demoStories = [
    { id: "story-1", caption: "За кулисами сегодня", mediaJson: JSON.stringify(["story-bts"]) },
    { id: "story-2", caption: "Новый материал приехал!", mediaJson: JSON.stringify(["story-material"]) },
  ];
  const storyExpiry = new Date(Date.now() + 20 * 60 * 60 * 1000);
  for (const s of demoStories) {
    if (!db.select().from(schema.publications).where(eq(schema.publications.id, s.id)).get()) {
      db.insert(schema.publications)
        .values({
          id: s.id,
          userId: "u-nyx",
          caption: s.caption,
          mediaJson: s.mediaJson,
          tagsJson: "[]",
          kind: "story",
          expiresAt: storyExpiry,
        })
        .run();
    }
  }

  if (!db.select().from(schema.publicationMentions).where(eq(schema.publicationMentions.id, "men-1")).get()) {
    db.insert(schema.publicationMentions)
      .values({ id: "men-1", publicationId: "pub-1", userId: "u-luna", displayName: "luna.s", type: "user" })
      .run();
    db.insert(schema.publicationMentions)
      .values({ id: "men-2", publicationId: "pub-3", userId: null, displayName: "Иван (фотограф)", type: "person" })
      .run();
  }

  const DEMO_COMMENTS: {
    id: string;
    targetType: "build" | "publication";
    targetId: string;
    userId: string;
    text: string;
    parentId?: string;
    hoursAgo: number;
  }[] = [
    { id: "c-jinx-1", targetType: "build", targetId: "jinx", userId: "u-luna", text: "Цвета просто огонь. Какой краской красишь парик?", hoursAgo: 30 },
    { id: "c-jinx-2", targetType: "build", targetId: "jinx", userId: "u-nyx", text: "Arctic Fox + термозащита, потом фиксирую лаком.", parentId: "c-jinx-1", hoursAgo: 28 },
    { id: "c-jinx-3", targetType: "build", targetId: "jinx", userId: "u-victor", text: "Пропы на плече — EVA или worbla?", hoursAgo: 20 },
    { id: "c-jinx-4", targetType: "build", targetId: "jinx", userId: "u-raiden", text: "Снимем это на CosFest, если ещё открыта запись.", hoursAgo: 8 },
    { id: "c-raiden-1", targetType: "build", targetId: "raiden", userId: "u-nyx", text: "Градиент на кимоно нереальный. Сколько слоёв краски?", hoursAgo: 40 },
    { id: "c-raiden-2", targetType: "build", targetId: "raiden", userId: "u-luna", text: "Три слоя airbrush + лак. Реф могу скинуть в лс.", parentId: "c-raiden-1", hoursAgo: 36 },
    { id: "c-raiden-3", targetType: "build", targetId: "raiden", userId: "u-victor", text: "Наручи печатал на PETG, потом шпаклёвка.", hoursAgo: 12 },
    { id: "c-miku-1", targetType: "build", targetId: "miku", userId: "u-luna", text: "Юбка сидит идеально. Выкройку делала сама?", hoursAgo: 18 },
    { id: "c-miku-2", targetType: "build", targetId: "miku", userId: "u-raiden", text: "Хочу такой сет на съёмку.", hoursAgo: 6 },
    { id: "c-2b-1", targetType: "build", targetId: "2b", userId: "u-nyx", text: "Слепое пятно на визоре — как снимала?", hoursAgo: 22 },
    { id: "c-cloud-1", targetType: "build", targetId: "cloud", userId: "u-luna", text: "Меч выглядит тяжёлым. Это полый EVA?", hoursAgo: 15 },
    { id: "c-yae-1", targetType: "build", targetId: "yae", userId: "u-nyx", text: "Ушки живые? Хочу такой же механизм.", hoursAgo: 10 },
    { id: "c-makima-1", targetType: "build", targetId: "makima", userId: "u-luna", text: "Пиджак сидит как с иголки.", hoursAgo: 48 },
    { id: "c-nezuko-1", targetType: "build", targetId: "nezuko", userId: "u-victor", text: "Бамбук — 3D или резьба?", hoursAgo: 26 },
    { id: "c-pub1-1", targetType: "publication", targetId: "pub-1", userId: "u-luna", text: "Финальная примерка выглядит готовой к сцене 🔥", hoursAgo: 14 },
    { id: "c-pub1-2", targetType: "publication", targetId: "pub-1", userId: "u-raiden", text: "Свет на золоте идеальный. Можно тег на фото?", hoursAgo: 9 },
    { id: "c-pub1-3", targetType: "publication", targetId: "pub-1", userId: "u-victor", text: "Корсет держит силуэт. Какая сетка внутри?", hoursAgo: 4 },
    { id: "c-pub1-4", targetType: "publication", targetId: "pub-1", userId: "u-nyx", text: "Сетка стальная, 8 спиц. Потом гайд в заметках.", parentId: "c-pub1-3", hoursAgo: 3 },
    { id: "c-pub2-1", targetType: "publication", targetId: "pub-2", userId: "u-luna", text: "Пряди легли ровно, кайф.", hoursAgo: 11 },
    { id: "c-pub3-1", targetType: "publication", targetId: "pub-3", userId: "u-luna", text: "Backstage всегда лучше сцены.", hoursAgo: 7 },
    { id: "c-pub6-1", targetType: "publication", targetId: "pub-6", userId: "u-luna", text: "Жду полный Yae. Когда дебют?", hoursAgo: 16 },
    { id: "c-pub6-2", targetType: "publication", targetId: "pub-6", userId: "u-victor", text: "Ушки уже заказал печатать 👀", hoursAgo: 5 },
  ];

  for (const c of DEMO_COMMENTS) {
    if (db.select().from(schema.comments).where(eq(schema.comments.id, c.id)).get()) continue;
    db.insert(schema.comments)
      .values({
        id: c.id,
        targetType: c.targetType,
        targetId: c.targetId,
        userId: c.userId,
        text: c.text,
        parentId: c.parentId || null,
        createdAt: new Date(Date.now() - c.hoursAgo * 3600 * 1000),
      })
      .run();
  }

  const recount = (targetType: "build" | "publication", targetId: string) =>
    db
      .select()
      .from(schema.comments)
      .where(and(eq(schema.comments.targetType, targetType), eq(schema.comments.targetId, targetId)))
      .all().length;

  for (const b of BUILDS) {
    const n = recount("build", b.id);
    db.update(schema.builds).set({ commentsCount: n }).where(eq(schema.builds.id, b.id)).run();
  }
  for (const p of demoPosts) {
    const n = recount("publication", p.id);
    db.update(schema.publications).set({ commentsCount: n }).where(eq(schema.publications.id, p.id)).run();
  }

  console.log("✓ Demo seed ready (demo.nyx / luna.s · пароль alter123)");
}
