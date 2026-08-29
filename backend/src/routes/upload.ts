import { Router } from "express";
import { v4 as uuid } from "uuid";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { putUpload } from "../lib/storage";
import { putImageWithVariants } from "../lib/imageVariants";

const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "audio/webm",
  "audio/mpeg",
  "audio/wav",
  "application/pdf",
  "application/zip",
]);

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "audio/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "application/pdf": "pdf",
  "application/zip": "zip",
};

const IMAGE_FOR_VARIANTS = new Set(["image/jpeg", "image/png", "image/webp"]);

const MAX = 25 * 1024 * 1024;

const router = Router();

router.post("/", authMiddleware, (req: AuthRequest, res) => {
  const chunks: Buffer[] = [];
  let size = 0;

  req.on("data", (c: Buffer) => {
    size += c.length;
    if (size > MAX) {
      res.status(413).json({ error: "File too large" });
      req.destroy();
      return;
    }
    chunks.push(c);
  });

  req.on("end", () => {
    void (async () => {
      try {
        const mime = String(req.headers["x-file-type"] || req.headers["content-type"] || "");
        const cleanMime = mime.split(";")[0].trim();
        if (!ALLOWED.has(cleanMime)) {
          return res.status(400).json({ error: "MIME not allowed" });
        }
        const name = String(req.headers["x-file-name"] || `file.${EXT[cleanMime]}`);
        const filename = `${uuid()}.${EXT[cleanMime]}`;
        const body = Buffer.concat(chunks);

        if (IMAGE_FOR_VARIANTS.has(cleanMime)) {
          const stored = await putImageWithVariants(filename, body, cleanMime);
          return res.status(201).json({
            url: stored.url,
            cardUrl: stored.cardUrl || null,
            thumbUrl: stored.thumbUrl || null,
            fileName: name,
            fileSize: size,
            mime: cleanMime,
            storage: stored.driver,
          });
        }

        const stored = await putUpload(filename, body, cleanMime);
        res.status(201).json({
          url: stored.url,
          fileName: name,
          fileSize: size,
          mime: cleanMime,
          storage: stored.driver,
        });
      } catch (err: unknown) {
        console.error("[upload]", err);
        if (!res.headersSent) {
          res.status(500).json({ error: err instanceof Error ? err.message : "Upload failed" });
        }
      }
    })();
  });
});

export default router;
