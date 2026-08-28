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
  likedByMe?: boolean;
  username?: string;
};

export function normalizePublication(raw: any): Publication {
  return {
    id: raw.id,
    caption: raw.caption,
    mediaUrls: raw.mediaUrls || JSON.parse(raw.mediaJson || "[]"),
    tags: raw.tags || JSON.parse(raw.tagsJson || "[]"),
    kind: raw.kind === "story" ? "story" : "post",
    likesCount: raw.likesCount ?? 0,
    commentsCount: raw.commentsCount ?? 0,
    mentions: raw.mentions || [],
    createdAt: raw.createdAt,
    likedByMe: Boolean(raw.likedByMe),
    username: raw.author?.username || raw.username,
  };
}
