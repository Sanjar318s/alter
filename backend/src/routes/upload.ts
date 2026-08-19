import { Router } from "express";
import fs from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { authMiddleware, AuthRequest } from "../middleware/auth";

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

const MAX = 25 * 1024 * 1024;
const dir = path.join(__dirname, "..", "..", "uploads");
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

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
    const mime = String(req.headers["x-file-type"] || req.headers["content-type"] || "");
    const cleanMime = mime.split(";")[0].trim();
    if (!ALLOWED.has(cleanMime)) {
      return res.status(400).json({ error: "MIME not allowed" });
    }
    const name = String(req.headers["x-file-name"] || `file.${EXT[cleanMime]}`);
    const id = uuid();
    const filename = `${id}.${EXT[cleanMime]}`;
    fs.writeFileSync(path.join(dir, filename), Buffer.concat(chunks));
    res.status(201).json({
      url: `/uploads/${filename}`,
      fileName: name,
      fileSize: size,
      mime: cleanMime,
    });
  });
});

export default router;
