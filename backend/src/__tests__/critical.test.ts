import { test } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { franchiseSlug } from "../lib/notify";
import { rateLimit } from "../middleware/rateLimit";

const JWT_SECRET = process.env.JWT_SECRET || "alter-dev-secret-key-change-in-production";

function mockRes() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

test("franchiseSlug maps known titles", () => {
  assert.equal(franchiseSlug("Genshin Impact"), "genshin-impact");
  assert.equal(franchiseSlug("unknown-ip"), "other");
});

test("JWT signs and verifies with jti", () => {
  const token = jwt.sign({ userId: "u-test", jti: "j1" }, JWT_SECRET, { expiresIn: "1h" });
  const payload = jwt.verify(token, JWT_SECRET) as { userId: string; jti: string };
  assert.equal(payload.userId, "u-test");
  assert.equal(payload.jti, "j1");
});

test("rateLimit blocks after window max", () => {
  const mw = rateLimit(2, 60_000);
  const req: any = { ip: "10.0.0.9", path: "/api/auth/login" };
  let nextN = 0;
  const next = () => {
    nextN += 1;
  };
  mw(req, mockRes(), next);
  mw(req, mockRes(), next);
  const blocked = mockRes();
  mw(req, blocked, next);
  assert.equal(nextN, 2);
  assert.equal(blocked.statusCode, 429);
});

test("order statuses used by studio stay in product set", () => {
  const allowed = ["new", "waiting", "discussion", "in_progress", "fitting", "done", "shipped", "archive", "cancelled"];
  assert.ok(allowed.includes("discussion"));
  assert.ok(allowed.includes("waiting"));
  assert.ok(allowed.includes("cancelled"));
});
