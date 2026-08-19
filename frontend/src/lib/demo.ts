export type BuildCard = {
  id: string;
  title: string;
  character: string;
  franchise: string;
  author: string;
  authorAvatar: string;
  image: string;
  status: "open" | "waitlist" | "closed";
  likesCount: number;
  commentsCount: number;
  year: number;
  price: number;
  currency: "UZS";
  category: string;
  tags: string[];
  isLiked: boolean;
  isVerified: boolean;
  role: "cosplayer" | "maker" | "photographer";
};

export const PALETTES = [
  "linear-gradient(145deg, #5C1F3A 0%, #E5487A 42%, #1D1A29 100%)",
  "linear-gradient(160deg, #4A3210 0%, #F2A93B 38%, #12101A 100%)",
  "linear-gradient(150deg, #241C48 0%, #6B5B95 45%, #12101A 100%)",
  "linear-gradient(155deg, #143636 0%, #3D8B8B 40%, #12101A 100%)",
  "linear-gradient(148deg, #3A1A2A 0%, #8B3A5A 44%, #1D1A29 100%)",
  "linear-gradient(162deg, #2A2410 0%, #8B7A3A 36%, #12101A 100%)",
  "linear-gradient(140deg, #1A2A40 0%, #4A7AB0 42%, #12101A 100%)",
  "linear-gradient(170deg, #3A1020 0%, #C45C6A 40%, #1D1A29 100%)",
];

export function filmFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h + seed.charCodeAt(i) * (i + 1)) % PALETTES.length;
  return PALETTES[h];
}

export const BUILDS: BuildCard[] = [
  { id: "jinx", title: "Jinx", character: "JINX", franchise: "LEAGUE OF LEGENDS", author: "nyx.cosplay", authorAvatar: "", image: "", status: "open", likesCount: 1200, commentsCount: 23, year: 2024, price: 450000, currency: "UZS", category: "league-of-legends", tags: ["arcane"], isLiked: false, isVerified: true, role: "cosplayer" },
  { id: "raiden", title: "Raiden Shogun", character: "RAIDEN SHOGUN", franchise: "GENSHIN IMPACT", author: "luna.s", authorAvatar: "", image: "", status: "open", likesCount: 1800, commentsCount: 42, year: 2025, price: 800000, currency: "UZS", category: "genshin-impact", tags: ["inazuma"], isLiked: true, isVerified: true, role: "maker" },
  { id: "miku", title: "Miku", character: "MIKU", franchise: "VOCALOID", author: "vocaloid.uz", authorAvatar: "", image: "", status: "open", likesCount: 2300, commentsCount: 35, year: 2024, price: 200000, currency: "UZS", category: "vocaloid", tags: [], isLiked: false, isVerified: false, role: "cosplayer" },
  { id: "2b", title: "2B", character: "2B", franchise: "NIER: AUTOMATA", author: "raiden.photo", authorAvatar: "", image: "", status: "waitlist", likesCount: 980, commentsCount: 18, year: 2025, price: 620000, currency: "UZS", category: "nier-automata", tags: [], isLiked: false, isVerified: true, role: "photographer" },
  { id: "cloud", title: "Cloud Strife", character: "CLOUD STRIFE", franchise: "FINAL FANTASY VII", author: "sephy.cos", authorAvatar: "", image: "", status: "open", likesCount: 1600, commentsCount: 31, year: 2023, price: 700000, currency: "UZS", category: "other", tags: [], isLiked: false, isVerified: false, role: "cosplayer" },
  { id: "yae", title: "Yae Miko", character: "YAE MIKO", franchise: "GENSHIN IMPACT", author: "kitsune.maker", authorAvatar: "", image: "", status: "waitlist", likesCount: 1100, commentsCount: 27, year: 2025, price: 900000, currency: "UZS", category: "genshin-impact", tags: [], isLiked: false, isVerified: true, role: "maker" },
  { id: "makima", title: "Makima", character: "MAKIMA", franchise: "CHAINSAW MAN", author: "nyx.cosplay", authorAvatar: "", image: "", status: "closed", likesCount: 740, commentsCount: 12, year: 2024, price: 0, currency: "UZS", category: "chainsaw-man", tags: [], isLiked: false, isVerified: true, role: "cosplayer" },
  { id: "albedo", title: "Albedo", character: "ALBEDO", franchise: "GENSHIN IMPACT", author: "luna.s", authorAvatar: "", image: "", status: "open", likesCount: 890, commentsCount: 19, year: 2025, price: 550000, currency: "UZS", category: "genshin-impact", tags: [], isLiked: false, isVerified: true, role: "maker" },
  { id: "dva", title: "D.Va", character: "D.VA", franchise: "OVERWATCH", author: "wired.wigs", authorAvatar: "", image: "", status: "open", likesCount: 1320, commentsCount: 28, year: 2024, price: 380000, currency: "UZS", category: "overwatch", tags: [], isLiked: false, isVerified: false, role: "maker" },
  { id: "nezuko", title: "Nezuko", character: "NEZUKO KAMADO", franchise: "DEMON SLAYER", author: "nyx.cosplay", authorAvatar: "", image: "", status: "open", likesCount: 1540, commentsCount: 22, year: 2023, price: 420000, currency: "UZS", category: "demon-slayer", tags: [], isLiked: false, isVerified: true, role: "cosplayer" },
  { id: "levi", title: "Levi", character: "LEVI ACKERMAN", franchise: "ATTACK ON TITAN", author: "forge.atelier", authorAvatar: "", image: "", status: "closed", likesCount: 610, commentsCount: 9, year: 2022, price: 0, currency: "UZS", category: "other", tags: [], isLiked: false, isVerified: false, role: "maker" },
  { id: "maria", title: "Lady Maria", character: "LADY MARIA", franchise: "BLOODBORNE", author: "lumen.cos", authorAvatar: "", image: "", status: "waitlist", likesCount: 870, commentsCount: 15, year: 2025, price: 1100000, currency: "UZS", category: "other", tags: [], isLiked: false, isVerified: true, role: "cosplayer" },
  { id: "furina", title: "Furina", character: "FURINA", franchise: "GENSHIN IMPACT", author: "nyx.cosplay", authorAvatar: "", image: "", status: "open", likesCount: 2100, commentsCount: 41, year: 2024, price: 680000, currency: "UZS", category: "genshin-impact", tags: [], isLiked: false, isVerified: true, role: "cosplayer" },
  { id: "hutao", title: "Hu Tao", character: "HU TAO", franchise: "GENSHIN IMPACT", author: "luna.s", authorAvatar: "", image: "", status: "open", likesCount: 1450, commentsCount: 24, year: 2025, price: 520000, currency: "UZS", category: "genshin-impact", tags: [], isLiked: false, isVerified: true, role: "cosplayer" },
  { id: "gojo", title: "Gojo", character: "GOJO SATORU", franchise: "JUJUTSU KAISEN", author: "raiden.photo", authorAvatar: "", image: "", status: "open", likesCount: 1900, commentsCount: 33, year: 2024, price: 410000, currency: "UZS", category: "jujutsu-kaisen", tags: [], isLiked: false, isVerified: true, role: "photographer" },
  { id: "kafka", title: "Kafka", character: "KAFKA", franchise: "HONKAI STAR RAIL", author: "victor.maker", authorAvatar: "", image: "", status: "waitlist", likesCount: 1020, commentsCount: 16, year: 2025, price: 760000, currency: "UZS", category: "honkai-star-rail", tags: [], isLiked: false, isVerified: true, role: "maker" },
  { id: "seele", title: "Seele", character: "SEELE", franchise: "HONKAI STAR RAIL", author: "nyx.cosplay", authorAvatar: "", image: "", status: "open", likesCount: 880, commentsCount: 14, year: 2023, price: 390000, currency: "UZS", category: "honkai-star-rail", tags: [], isLiked: false, isVerified: true, role: "cosplayer" },
  { id: "asuka", title: "Asuka", character: "ASUKA", franchise: "EVANGELION", author: "lumen.cos", authorAvatar: "", image: "", status: "closed", likesCount: 560, commentsCount: 8, year: 2022, price: 0, currency: "UZS", category: "other", tags: [], isLiked: false, isVerified: false, role: "cosplayer" },
  { id: "tifa", title: "Tifa", character: "TIFA LOCKHART", franchise: "FINAL FANTASY VII", author: "victor.maker", authorAvatar: "", image: "", status: "open", likesCount: 1710, commentsCount: 29, year: 2025, price: 840000, currency: "UZS", category: "other", tags: [], isLiked: false, isVerified: true, role: "maker" },
];

export const CATEGORIES = [
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

export function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

export function formatSum(n: number) {
  return `${n.toLocaleString("ru-RU")} сум`;
}
