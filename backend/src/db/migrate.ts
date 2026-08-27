import { sqlite } from "./index";

function addColumn(table: string, column: string, def: string) {
  try {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
  } catch {
    // already exists
  }
}

export function migrate() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL, role_flags TEXT DEFAULT 'cosplayer',
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      display_name TEXT, bio TEXT, avatar_url TEXT, links_json TEXT,
      privacy_settings TEXT DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS builds (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL, franchise TEXT, character TEXT, cover_image_url TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS build_photos (
      id TEXT PRIMARY KEY, build_id TEXT NOT NULL REFERENCES builds(id) ON DELETE CASCADE,
      image_url TEXT NOT NULL, maker_id TEXT REFERENCES users(id),
      photographer_id TEXT REFERENCES users(id), consent_status TEXT DEFAULT 'pending'
    );
    CREATE TABLE IF NOT EXISTS stories (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      build_id TEXT REFERENCES builds(id), text TEXT NOT NULL, media_url TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS commissions (
      id TEXT PRIMARY KEY, maker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL, description TEXT, price_from INTEGER,
      turnaround_days INTEGER, status TEXT DEFAULT 'open'
    );
    CREATE TABLE IF NOT EXISTS commission_requests (
      id TEXT PRIMARY KEY, commission_id TEXT NOT NULL REFERENCES commissions(id) ON DELETE CASCADE,
      requester_user_id TEXT REFERENCES users(id), contact TEXT,
      references_json TEXT, measurements_json TEXT, status TEXT DEFAULT 'new',
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, commission_request_id TEXT NOT NULL REFERENCES commission_requests(id) ON DELETE CASCADE,
      maker_id TEXT NOT NULL REFERENCES users(id), status TEXT DEFAULT 'new',
      deposit_amount REAL, deposit_paid INTEGER DEFAULT 0, deadline INTEGER
    );
    CREATE TABLE IF NOT EXISTS credits (
      id TEXT PRIMARY KEY, target_type TEXT NOT NULL, target_id TEXT NOT NULL,
      credited_user_id TEXT NOT NULL REFERENCES users(id), role TEXT NOT NULL,
      confirmed INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL, payload_json TEXT, read INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan TEXT NOT NULL, status TEXT DEFAULT 'inactive', started_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY, type TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS conversation_members (
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT DEFAULT 'member', joined_at INTEGER NOT NULL DEFAULT (unixepoch()),
      last_read_at INTEGER, PRIMARY KEY (conversation_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_id TEXT NOT NULL REFERENCES users(id), text TEXT, media_url TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()), deleted INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      kind TEXT NOT NULL, title TEXT NOT NULL, related_franchise TEXT,
      related_event_date INTEGER, archived INTEGER DEFAULT 0, write_mode TEXT DEFAULT 'members'
    );
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY, target_type TEXT NOT NULL, target_id TEXT NOT NULL,
      reporter_id TEXT NOT NULL REFERENCES users(id), reason TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      assigned_to TEXT REFERENCES users(id),
      assigned_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS blocks (
      blocker_id TEXT NOT NULL REFERENCES users(id),
      blocked_id TEXT NOT NULL REFERENCES users(id),
      reason TEXT,
      details TEXT,
      files_json TEXT,
      expires_at INTEGER,
      source TEXT DEFAULT 'manual',
      created_by TEXT REFERENCES users(id),
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (blocker_id, blocked_id)
    );
    CREATE TABLE IF NOT EXISTS admin_permissions (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      can_view_users INTEGER DEFAULT 1,
      can_view_reports INTEGER DEFAULT 1,
      can_view_orders INTEGER DEFAULT 1,
      can_view_chats INTEGER DEFAULT 1,
      can_view_finance INTEGER DEFAULT 0,
      can_manage_staff INTEGER DEFAULT 0,
      can_use_blacklist INTEGER DEFAULT 0,
      updated_by TEXT REFERENCES users(id),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      actor_id TEXT REFERENCES users(id),
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      severity TEXT DEFAULT 'info',
      payload_json TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS moderation_settings (
      id TEXT PRIMARY KEY,
      auto_escalate_enabled INTEGER DEFAULT 1,
      auto_escalate_interval_ms INTEGER DEFAULT 300000,
      escalation_cooldown_ms INTEGER DEFAULT 21600000,
      updated_by TEXT REFERENCES users(id),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS publications (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      caption TEXT, media_json TEXT NOT NULL DEFAULT '[]', tags_json TEXT DEFAULT '[]',
      kind TEXT NOT NULL, expires_at INTEGER, likes_count INTEGER DEFAULT 0,
      comments_count INTEGER DEFAULT 0, created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS publication_mentions (
      id TEXT PRIMARY KEY, publication_id TEXT NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id), display_name TEXT NOT NULL, type TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS follows (
      follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      following_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (follower_id, following_id)
    );
    CREATE TABLE IF NOT EXISTS build_likes (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      build_id TEXT NOT NULL REFERENCES builds(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (user_id, build_id)
    );
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      parent_id TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS pending_signups (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      password_hash TEXT NOT NULL,
      role_flags TEXT DEFAULT 'cosplayer',
      channel TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      attempts INTEGER DEFAULT 0,
      last_sent_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      kind TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS order_status_history (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      note TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS calendar_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      starts_at INTEGER NOT NULL,
      ends_at INTEGER,
      note TEXT,
      order_id TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS conversation_settings (
      conversation_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      muted INTEGER DEFAULT 0,
      pinned INTEGER DEFAULT 0,
      PRIMARY KEY (conversation_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS account_notification_settings (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      orders INTEGER DEFAULT 1,
      messages INTEGER DEFAULT 1,
      likes INTEGER DEFAULT 1,
      follows INTEGER DEFAULT 1,
      email INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS publication_likes (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      publication_id TEXT NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (user_id, publication_id)
    );
    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      channel TEXT NOT NULL,
      target TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      attempts INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS revoked_tokens (
      jti TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS client_notes (
      maker_id TEXT NOT NULL,
      client_id TEXT NOT NULL,
      note TEXT,
      PRIMARY KEY (maker_id, client_id)
    );
    CREATE TABLE IF NOT EXISTS withdrawals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      method TEXT NOT NULL,
      details TEXT,
      status TEXT DEFAULT 'pending',
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  addColumn("users", "phone", "TEXT");
  addColumn("users", "platform_role", "TEXT");

  const profileCols: [string, string][] = [
    ["city", "TEXT"],
    ["country", "TEXT"],
    ["commission_status", "TEXT DEFAULT 'open'"],
    ["last_seen", "INTEGER"],
    ["is_verified", "INTEGER DEFAULT 0"],
    ["is_private", "INTEGER DEFAULT 0"],
    ["cover_url", "TEXT"],
    ["phone", "TEXT"],
    ["languages_json", "TEXT"],
    ["specializations_json", "TEXT"],
    ["availability", "TEXT DEFAULT 'open'"],
    ["max_active_orders", "INTEGER DEFAULT 4"],
    ["date_of_birth", "TEXT"],
    ["show_age", "INTEGER DEFAULT 0"],
    ["commission_complexity", "TEXT"],
    ["commission_types", "TEXT"],
    ["commission_duration", "TEXT"],
    ["price_min", "INTEGER"],
    ["price_max", "INTEGER"],
    ["events_json", "TEXT"],
    ["experience_years", "INTEGER"],
    ["materials_json", "TEXT"],
    ["ui_locale", "TEXT"],
    ["ui_currency", "TEXT"],
    ["staff_role", "TEXT DEFAULT 'none'"],
    ["staff_badge_hidden", "INTEGER DEFAULT 0"],
  ];
  for (const [c, d] of profileCols) addColumn("profiles", c, d);

  const buildCols: [string, string][] = [
    ["likes_count", "INTEGER DEFAULT 0"],
    ["comments_count", "INTEGER DEFAULT 0"],
    ["year", "INTEGER"],
    ["price", "INTEGER DEFAULT 0"],
    ["currency", "TEXT DEFAULT 'UZS'"],
    ["category", "TEXT"],
    ["tags_json", "TEXT"],
    ["commission_status", "TEXT"],
    ["hidden", "INTEGER DEFAULT 0"],
    ["description", "TEXT"],
    ["work_type", "TEXT"],
  ];
  for (const [c, d] of buildCols) addColumn("builds", c, d);

  const orderCols: [string, string][] = [
    ["title", "TEXT"],
    ["character", "TEXT"],
    ["franchise", "TEXT"],
    ["client_id", "TEXT"],
    ["budget", "REAL"],
    ["paid_amount", "REAL"],
    ["remaining_amount", "REAL"],
    ["notes", "TEXT"],
    ["cover_image", "TEXT"],
    ["checklist_json", "TEXT"],
    ["activity_json", "TEXT"],
    ["files_json", "TEXT"],
    ["pinned", "INTEGER DEFAULT 0"],
    ["tracking_number", "TEXT"],
    ["carrier", "TEXT"],
    ["cancel_reason", "TEXT"],
    ["conversation_id", "TEXT"],
  ];
  for (const [c, d] of orderCols) addColumn("orders", c, d);

  const msgCols: [string, string][] = [
    ["type", "TEXT DEFAULT 'text'"],
    ["duration", "INTEGER"],
    ["file_name", "TEXT"],
    ["file_size", "INTEGER"],
    ["reply_to", "TEXT"],
    ["reactions_json", "TEXT"],
    ["edited_at", "INTEGER"],
    ["status", "TEXT DEFAULT 'sent'"],
  ];
  for (const [c, d] of msgCols) addColumn("messages", c, d);

  addColumn("reports", "details", "TEXT");
  addColumn("reports", "files_json", "TEXT");
  addColumn("reports", "assigned_to", "TEXT");
  addColumn("reports", "assigned_at", "INTEGER");
  addColumn("channels", "write_mode", "TEXT DEFAULT 'members'");
  addColumn("channels", "sort_order", "INTEGER DEFAULT 0");
  addColumn("channels", "manager_ids_json", "TEXT");
  addColumn("blocks", "reason", "TEXT");
  addColumn("blocks", "details", "TEXT");
  addColumn("blocks", "files_json", "TEXT");
  addColumn("blocks", "expires_at", "INTEGER");
  addColumn("blocks", "source", "TEXT DEFAULT 'manual'");
  addColumn("blocks", "created_by", "TEXT");
  sqlite.exec(`
    INSERT OR IGNORE INTO moderation_settings (id, auto_escalate_enabled, auto_escalate_interval_ms, escalation_cooldown_ms)
    VALUES ('global', 1, 300000, 21600000)
  `);
  sqlite.exec("UPDATE channels SET write_mode='owner_only' WHERE id='ch-blacklist'");
  sqlite.exec("UPDATE channels SET sort_order = COALESCE(sort_order, 0)");

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS partners (
      id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, type TEXT NOT NULL, name TEXT NOT NULL,
      city TEXT, country TEXT, logo_url TEXT, cover_url TEXT, description TEXT,
      contact_email TEXT, website_url TEXT, status TEXT DEFAULT 'draft',
      package_tier TEXT, contract_ref TEXT, active_from INTEGER, active_until INTEGER,
      features_json TEXT DEFAULT '{}',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS partner_applications (
      id TEXT PRIMARY KEY, type TEXT NOT NULL, city TEXT, contact_name TEXT NOT NULL,
      contact_email TEXT NOT NULL, message TEXT, status TEXT DEFAULT 'new',
      reviewed_by TEXT REFERENCES users(id), reviewed_at INTEGER,
      partner_id TEXT REFERENCES partners(id),
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS partner_members (
      partner_id TEXT NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT DEFAULT 'editor', created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (partner_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS partner_makers (
      id TEXT PRIMARY KEY, partner_id TEXT NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      sort_order INTEGER DEFAULT 0, badge_label TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS rental_items (
      id TEXT PRIMARY KEY, partner_id TEXT NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
      title TEXT NOT NULL, description TEXT, photos_json TEXT DEFAULT '[]',
      price INTEGER, currency TEXT DEFAULT 'UZS', size TEXT, franchise TEXT,
      available_from INTEGER, available_to INTEGER, status TEXT DEFAULT 'active',
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS partner_events (
      id TEXT PRIMARY KEY, partner_id TEXT NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
      slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, city TEXT,
      starts_at INTEGER, ends_at INTEGER, channel_id TEXT REFERENCES channels(id),
      cover_url TEXT, program_json TEXT DEFAULT '[]', links_json TEXT DEFAULT '[]',
      status TEXT DEFAULT 'draft', created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS ad_campaigns (
      id TEXT PRIMARY KEY, partner_id TEXT NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
      name TEXT NOT NULL, status TEXT DEFAULT 'draft',
      starts_at INTEGER, ends_at INTEGER, targeting_json TEXT DEFAULT '{}',
      budget_cents INTEGER, package_tier TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS ad_placements (
      id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
      slot_id TEXT NOT NULL, creative_json TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0, weight INTEGER DEFAULT 100,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS ad_events (
      id TEXT PRIMARY KEY, placement_id TEXT NOT NULL REFERENCES ad_placements(id) ON DELETE CASCADE,
      type TEXT NOT NULL, user_id TEXT REFERENCES users(id),
      session_id TEXT, city TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS app_kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS moderation_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'role_change',
      current_role TEXT,
      requested_role TEXT NOT NULL,
      reason TEXT NOT NULL,
      activity_explanation TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      reviewer_id TEXT REFERENCES users(id),
      review_note TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      reviewed_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_moderation_requests_status ON moderation_requests(status);
    CREATE INDEX IF NOT EXISTS idx_ad_placements_slot ON ad_placements(slot_id);
    CREATE INDEX IF NOT EXISTS idx_ad_events_placement ON ad_events(placement_id);
    CREATE INDEX IF NOT EXISTS idx_partner_events_starts ON partner_events(starts_at);

    CREATE TABLE IF NOT EXISTS social_moderation (
      id TEXT PRIMARY KEY,
      content_type TEXT NOT NULL,
      content_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      confidence TEXT,
      reason TEXT,
      gemini_model TEXT,
      gemini_raw_json TEXT,
      reviewed_by TEXT REFERENCES users(id),
      reviewed_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE (content_type, content_id)
    );
    CREATE INDEX IF NOT EXISTS idx_social_moderation_status ON social_moderation(status);

    CREATE TABLE IF NOT EXISTS social_jobs (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      platform TEXT,
      content_type TEXT NOT NULL,
      content_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      attempts INTEGER DEFAULT 0,
      max_attempts INTEGER DEFAULT 5,
      run_after INTEGER NOT NULL DEFAULT (unixepoch()),
      locked_at INTEGER,
      last_error TEXT,
      payload_json TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_social_jobs_poll ON social_jobs(status, run_after);

    CREATE TABLE IF NOT EXISTS social_posts (
      id TEXT PRIMARY KEY,
      content_type TEXT NOT NULL,
      content_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      status TEXT NOT NULL,
      external_id TEXT,
      external_url TEXT,
      tiktok_visibility TEXT,
      tiktok_legacy_publish_id TEXT,
      source_media_url TEXT,
      title TEXT,
      description TEXT,
      hashtags_json TEXT,
      likes_count INTEGER DEFAULT 0,
      comments_count INTEGER DEFAULT 0,
      last_synced_at INTEGER,
      published_at INTEGER,
      error TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE (content_type, content_id, platform)
    );
    CREATE INDEX IF NOT EXISTS idx_social_posts_content ON social_posts(content_type, content_id);
    CREATE INDEX IF NOT EXISTS idx_social_posts_sync ON social_posts(status, last_synced_at);

    CREATE TABLE IF NOT EXISTS social_oauth_tokens (
      provider TEXT PRIMARY KEY,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      expires_at INTEGER,
      extra_json TEXT,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS publication_views (
      id TEXT PRIMARY KEY,
      publication_id TEXT NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
      viewer_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      counted_at INTEGER NOT NULL DEFAULT (unixepoch()),
      window_started_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_publication_views_pair ON publication_views(publication_id, viewer_user_id);

    CREATE TABLE IF NOT EXISTS premium_grants (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      rule_set TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      starts_at INTEGER NOT NULL,
      ends_at INTEGER NOT NULL,
      snapshot_json TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_premium_grants_user ON premium_grants(user_id, status);
  `);

  addColumn("users", "social_crosspost_opt_in", "INTEGER DEFAULT 1");
  addColumn("publications", "counted_views", "INTEGER DEFAULT 0");
  addColumn("comments", "counts_for_premium", "INTEGER DEFAULT 0");
  addColumn("social_posts", "views_count", "INTEGER DEFAULT 0");
}
