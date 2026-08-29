import { Router } from "express";
import { v4 as uuid } from "uuid";
import { fromBuffer as fileTypeFromBuffer } from "file-type";
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

/** Map file-type mime → our allowlist mime when aliases differ */
const DETECT_ALIAS: Record<string, string> = {
  "audio/vnd.wave": "audio/wav",
  "audio/x-wav": "audio/wav",
  "application/x-zip-compressed": "application/zip",
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
        const claimed = String(req.headers["x-file-type"] || req.headers["content-type"] || "")
          .split(";")[0]
          .trim();
        if (!ALLOWED.has(claimed)) {
          return res.status(400).json({ error: "MIME not allowed" });
        }
        const body = Buffer.concat(chunks);
        const detected = await fileTypeFromBuffer(body);
        let mime = claimed;

        if (detected?.mime) {
          const normalized = DETECT_ALIAS[detected.mime] || detected.mime;
          if (!ALLOWED.has(normalized)) {
            return res.status(400).json({ error: "File type not allowed" });
          }
          // Claimed type must match detected (prevents polyglot spoof)
          if (normalized !== claimed) {
            // allow jpeg/jpg claim mismatch only if detected is jpeg
            if (!(claimed === "image/jpeg" && normalized === "image/jpeg")) {
              return res.status(400).json({ error: "MIME mismatch" });
            }
          }
          mime = normalized;
        } else if (
          claimed === "audio/webm" ||
          claimed === "audio/wav" ||
          claimed === "audio/mpeg"
        ) {
          // some audio containers lack strong signatures; keep claim if size ok
          mime = claimed;
        } else {
          return res.status(400).json({ error: "Could not detect file type" });
        }

        const name = String(req.headers["x-file-name"] || `file.${EXT[mime]}`);
        const filename = `${uuid()}.${EXT[mime]}`;

        if (IMAGE_FOR_VARIANTS.has(mime)) {
          const stored = await putImageWithVariants(filename, body, mime);
          return res.status(201).json({
            url: stored.url,
            cardUrl: stored.cardUrl || null,
            thumbUrl: stored.thumbUrl || null,
            fileName: name,
            fileSize: size,
            mime,
            storage: stored.driver,
          });
        }

        const stored = await putUpload(filename, body, mime);
        res.status(201).json({
          url: stored.url,
          fileName: name,
          fileSize: size,
          mime,
          storage: stored.driver,
        });
      } catch (err: unknown) {
        console.error("[upload]", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Upload failed" });
        }
      }
    })();
  });
});

export default router;
