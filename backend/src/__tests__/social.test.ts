import { test } from "node:test";
import assert from "node:assert/strict";
import { migrate } from "../db/migrate";
import { createOAuthState, consumeOAuthState } from "../lib/social/oauthState";
import { enabledPublishPlatforms } from "../lib/social/platforms";
import { enqueuePublishes } from "../lib/social/queue";
import { db, schema } from "../db";
import { eq } from "drizzle-orm";

test("enabledPublishPlatforms defaults to youtube only for publications", () => {
  const prev = process.env.SOCIAL_PUBLISH_PLATFORMS;
  delete process.env.SOCIAL_PUBLISH_PLATFORMS;
  const platforms = enabledPublishPlatforms("publication");
  assert.deepEqual(platforms, ["youtube"]);
  if (prev) process.env.SOCIAL_PUBLISH_PLATFORMS = prev;
});

test("SOCIAL_PUBLISH_PLATFORMS env overrides publication targets", () => {
  const prev = process.env.SOCIAL_PUBLISH_PLATFORMS;
  process.env.SOCIAL_PUBLISH_PLATFORMS = "youtube,tiktok";
  assert.deepEqual(enabledPublishPlatforms("publication"), ["youtube", "tiktok"]);
  process.env.SOCIAL_PUBLISH_PLATFORMS = "instagram";
  assert.deepEqual(enabledPublishPlatforms("publication"), []);
  if (prev) process.env.SOCIAL_PUBLISH_PLATFORMS = prev;
  else delete process.env.SOCIAL_PUBLISH_PLATFORMS;
});

test("oauth state is one-time use", () => {
  migrate();
  const state = createOAuthState("youtube", "u-test-owner");
  assert.equal(consumeOAuthState(state, "youtube"), "u-test-owner");
  assert.equal(consumeOAuthState(state, "youtube"), null);
  assert.equal(consumeOAuthState(state, "meta"), null);
});

test("enqueuePublishes queues youtube job only by default", () => {
  migrate();
  const contentId = `pub-test-${Date.now()}`;
  const prev = process.env.SOCIAL_PUBLISH_PLATFORMS;
  delete process.env.SOCIAL_PUBLISH_PLATFORMS;

  enqueuePublishes("publication", contentId);

  const jobs = db
    .select()
    .from(schema.socialJobs)
    .where(eq(schema.socialJobs.contentId, contentId))
    .all();
  const platforms = jobs.filter((j) => j.kind === "publish").map((j) => j.platform);
  assert.deepEqual(platforms, ["youtube"]);

  if (prev) process.env.SOCIAL_PUBLISH_PLATFORMS = prev;
});
