export type PublicationMention = {
  id: string;
  displayName: string;
  type: "user" | "person";
  username?: string;
  userId?: string;
};

export type Publication = {
  id: string;
  caption?: string;
  mediaUrls: string[];
  tags: string[];
  kind: "post" | "story";
  likesCount: number;
  commentsCount: number;
  mentions: PublicationMention[];
  createdAt?: string;
};

export const DEMO_PUBLICATIONS: Publication[] = [
  {
    id: "pub-1",
    caption: "Raiden 2.5 финальная примерка перед CosFest #genshin #raiden @luna.s",
    mediaUrls: ["raiden-final"],
    tags: ["genshin", "raiden", "cosfest"],
    kind: "post",
    likesCount: 142,
    commentsCount: 18,
    mentions: [{ id: "m1", displayName: "luna.s", type: "user", username: "luna.s" }],
  },
  {
    id: "pub-2",
    caption: "Jinx wig styling WIP #arcane #jinx",
    mediaUrls: ["jinx-wig"],
    tags: ["arcane", "jinx"],
    kind: "post",
    likesCount: 89,
    commentsCount: 7,
    mentions: [],
  },
  {
    id: "pub-3",
    caption: "Backstage CosFest с @raiden.photo",
    mediaUrls: ["backstage-1", "backstage-2"],
    tags: ["cosfest", "backstage"],
    kind: "post",
    likesCount: 256,
    commentsCount: 31,
    mentions: [{ id: "m2", displayName: "raiden.photo", type: "user", username: "raiden.photo" }],
  },
  {
    id: "pub-4",
    caption: "Корсетная сетка — процесс #maker #corset",
    mediaUrls: ["corset-wip"],
    tags: ["maker", "corset"],
    kind: "post",
    likesCount: 67,
    commentsCount: 5,
    mentions: [],
  },
  {
    id: "pub-5",
    caption: "Honkai meetup — спасибо всем! #honkai",
    mediaUrls: ["honkai-meet"],
    tags: ["honkai"],
    kind: "post",
    likesCount: 198,
    commentsCount: 22,
    mentions: [],
  },
  {
    id: "pub-6",
    caption: "Новый билд в работе — Yae Miko teaser #genshin",
    mediaUrls: ["yae-teaser"],
    tags: ["genshin", "yaemiko"],
    kind: "post",
    likesCount: 312,
    commentsCount: 44,
    mentions: [],
  },
];

export const DEMO_STORIES: Publication[] = [
  {
    id: "story-1",
    caption: "За кулисами сегодня",
    mediaUrls: ["story-bts"],
    tags: [],
    kind: "story",
    likesCount: 0,
    commentsCount: 0,
    mentions: [],
  },
  {
    id: "story-2",
    caption: "Новый материал приехал!",
    mediaUrls: ["story-material"],
    tags: [],
    kind: "story",
    likesCount: 0,
    commentsCount: 0,
    mentions: [],
  },
];

export function normalizePublication(raw: any): Publication {
  return {
    id: raw.id,
    caption: raw.caption,
    mediaUrls: raw.mediaUrls || JSON.parse(raw.mediaJson || "[]"),
    tags: raw.tags || JSON.parse(raw.tagsJson || "[]"),
    kind: raw.kind,
    likesCount: raw.likesCount ?? 0,
    commentsCount: raw.commentsCount ?? 0,
    mentions: raw.mentions || [],
    createdAt: raw.createdAt,
  };
}
