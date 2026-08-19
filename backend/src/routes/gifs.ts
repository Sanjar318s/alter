import { Router } from "express";
import { authMiddleware } from "../middleware/auth";

export type GifItem = {
  id: string;
  title: string;
  previewUrl: string;
  url: string;
};

const router = Router();

const FALLBACK_GIFS: GifItem[] = [
  {
    id: "fb-1",
    title: "hello wave",
    previewUrl: "https://media.giphy.com/media/ICOgUNjpvO0PC/200.gif",
    url: "https://media.giphy.com/media/ICOgUNjpvO0PC/giphy.gif",
  },
  {
    id: "fb-2",
    title: "anime happy",
    previewUrl: "https://media.giphy.com/media/13HgwGsXF0aiG/200.gif",
    url: "https://media.giphy.com/media/13HgwGsXF0aiG/giphy.gif",
  },
  {
    id: "fb-3",
    title: "cosplay",
    previewUrl: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/200.gif",
    url: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif",
  },
  {
    id: "fb-4",
    title: "celebrate",
    previewUrl: "https://media.giphy.com/media/11sBLWlvEwk7Lm/200.gif",
    url: "https://media.giphy.com/media/11sBLWlvEwk7Lm/giphy.gif",
  },
  {
    id: "fb-5",
    title: "thumbs up",
    previewUrl: "https://media.giphy.com/media/143v0Z4dMrOf76/200.gif",
    url: "https://media.giphy.com/media/143v0Z4dMrOf76/giphy.gif",
  },
  {
    id: "fb-6",
    title: "love",
    previewUrl: "https://media.giphy.com/media/26BRv0ThflsHCqDrG/200.gif",
    url: "https://media.giphy.com/media/26BRv0ThflsHCqDrG/giphy.gif",
  },
  {
    id: "fb-7",
    title: "dance",
    previewUrl: "https://media.giphy.com/media/3o7aCTPPm4OHfRLSH6/200.gif",
    url: "https://media.giphy.com/media/3o7aCTPPm4OHfRLSH6/giphy.gif",
  },
  {
    id: "fb-8",
    title: "wow",
    previewUrl: "https://media.giphy.com/media/5GoVLqeAi99CVApZFH/200.gif",
    url: "https://media.giphy.com/media/5GoVLqeAi99CVApZFH/giphy.gif",
  },
  {
    id: "fb-9",
    title: "cat",
    previewUrl: "https://media.giphy.com/media/JIX9t2j0ZTN9S/200.gif",
    url: "https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif",
  },
  {
    id: "fb-10",
    title: "yes",
    previewUrl: "https://media.giphy.com/media/l3q2K5jinAlChoCLS/200.gif",
    url: "https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif",
  },
  {
    id: "fb-11",
    title: "no",
    previewUrl: "https://media.giphy.com/media/mq5HwBjuOKS01OYC05/200.gif",
    url: "https://media.giphy.com/media/mq5HwBjuOKS01OYC05/giphy.gif",
  },
  {
    id: "fb-12",
    title: "thanks",
    previewUrl: "https://media.giphy.com/media/osjgQPWRx3cac/200.gif",
    url: "https://media.giphy.com/media/osjgQPWRx3cac/giphy.gif",
  },
];

function mapGiphyPayload(data: unknown): GifItem[] {
  const rows = (data as { data?: unknown[] })?.data || [];
  return rows
    .map((row) => {
      const g = row as {
        id?: string;
        title?: string;
        images?: Record<string, { url?: string }>;
      };
      const url =
        g.images?.original?.url ||
        g.images?.downsized_medium?.url ||
        g.images?.fixed_width?.url;
      const previewUrl =
        g.images?.fixed_width_small?.url ||
        g.images?.preview_gif?.url ||
        g.images?.fixed_width?.url ||
        url;
      if (!g.id || !url) return null;
      return {
        id: g.id,
        title: g.title || "",
        previewUrl: previewUrl || url,
        url,
      };
    })
    .filter(Boolean) as GifItem[];
}

async function fetchGiphy(path: string): Promise<GifItem[] | null> {
  const key = process.env.GIPHY_API_KEY;
  if (!key) return null;
  const res = await fetch(`https://api.giphy.com/v1/gifs/${path}&api_key=${key}&limit=24&rating=pg-13&lang=ru`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const items = mapGiphyPayload(data);
  return items.length ? items : null;
}

function filterFallback(q: string): GifItem[] {
  const needle = q.toLowerCase();
  return FALLBACK_GIFS.filter((g) => g.title.toLowerCase().includes(needle));
}

router.get("/trending", authMiddleware, async (_req, res) => {
  try {
    const items = await fetchGiphy("trending");
    if (items) return res.json({ gifs: items });
    res.json({ gifs: FALLBACK_GIFS, fallback: true });
  } catch {
    res.json({ gifs: FALLBACK_GIFS, fallback: true });
  }
});

router.get("/search", authMiddleware, async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) {
    const items = await fetchGiphy("trending").catch(() => null);
    return res.json({ gifs: items || FALLBACK_GIFS, fallback: !items });
  }
  try {
    const items = await fetchGiphy(`search?q=${encodeURIComponent(q)}`);
    if (items) return res.json({ gifs: items });
    res.json({ gifs: filterFallback(q), fallback: true });
  } catch {
    res.json({ gifs: filterFallback(q), fallback: true });
  }
});

export default router;
