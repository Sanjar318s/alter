import fs from "fs";
import path from "path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const localDir = path.join(__dirname, "..", "..", "uploads");

export type StorageDriver = "r2" | "local";

function r2Configured() {
  return Boolean(
    process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET &&
      (process.env.R2_ENDPOINT || process.env.R2_ACCOUNT_ID)
  );
}

export function storageDriver(): StorageDriver {
  return r2Configured() ? "r2" : "local";
}

function r2Endpoint() {
  if (process.env.R2_ENDPOINT) return process.env.R2_ENDPOINT;
  const accountId = process.env.R2_ACCOUNT_ID;
  if (!accountId) throw new Error("R2_ACCOUNT_ID or R2_ENDPOINT required");
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

let client: S3Client | null = null;

function r2Client() {
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: r2Endpoint(),
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return client;
}

function bucket() {
  return process.env.R2_BUCKET!;
}

function objectKey(filename: string) {
  return `uploads/${filename}`;
}

function ensureLocalDir() {
  if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
}

export async function verifyR2Bucket(): Promise<void> {
  if (!r2Configured()) return;
  await r2Client().send(new HeadBucketCommand({ Bucket: bucket() }));
}

export async function putUpload(
  filename: string,
  body: Buffer,
  contentType: string
): Promise<{ url: string; driver: StorageDriver }> {
  if (r2Configured()) {
    await r2Client().send(
      new PutObjectCommand({
        Bucket: bucket(),
        Key: objectKey(filename),
        Body: body,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
    const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
    const url = publicBase ? `${publicBase}/${objectKey(filename)}` : `/uploads/${filename}`;
    return { url, driver: "r2" };
  }

  ensureLocalDir();
  fs.writeFileSync(path.join(localDir, filename), body);
  return { url: `/uploads/${filename}`, driver: "local" };
}

export async function readUpload(filename: string): Promise<{
  body: Buffer;
  contentType: string;
} | null> {
  if (r2Configured()) {
    try {
      const out = await r2Client().send(
        new GetObjectCommand({ Bucket: bucket(), Key: objectKey(filename) })
      );
      if (!out.Body) return null;
      const bytes = await out.Body.transformToByteArray();
      return {
        body: Buffer.from(bytes),
        contentType: out.ContentType || "application/octet-stream",
      };
    } catch {
      return null;
    }
  }

  const file = path.join(localDir, filename);
  if (!fs.existsSync(file)) return null;
  return { body: fs.readFileSync(file), contentType: guessMime(filename) };
}

function filenameFromUploadUrl(url: string) {
  try {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return path.basename(new URL(url).pathname);
    }
  } catch {
    /* fall through */
  }
  return path.basename(url.split("?")[0]);
}

export async function deleteUpload(url?: string | null): Promise<void> {
  if (!url) return;
  const filename = filenameFromUploadUrl(url);
  if (!filename) return;

  if (r2Configured()) {
    try {
      await r2Client().send(
        new DeleteObjectCommand({ Bucket: bucket(), Key: objectKey(filename) })
      );
    } catch {
      /* ignore missing objects */
    }
    return;
  }

  try {
    const file = path.join(localDir, filename);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch {
    /* ignore */
  }
}

function guessMime(filename: string) {
  const ext = path.extname(filename).slice(1).toLowerCase();
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    mp4: "video/mp4",
    webm: "video/webm",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    pdf: "application/pdf",
    zip: "application/zip",
  };
  return map[ext] || "application/octet-stream";
}

export function uploadsRouter(
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction
) {
  const filename = path.basename(req.path);
  if (!filename || filename === "." || filename.includes("..")) {
    return res.status(400).json({ error: "Invalid path" });
  }

  void readUpload(filename).then((file) => {
    if (!file) return next();
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.send(file.body);
  });
}
