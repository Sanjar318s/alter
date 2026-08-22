import { sqliteTable, text, integer, real, unique } from "drizzle-orm/sqlite-core";

// ─── Users & Auth ───────────────────────────────────────────

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  roleFlags: text("role_flags").default("cosplayer"),
  phone: text("phone"),
  /** One-time platform role: client | blogger | seller */
  platformRole: text("platform_role"),
  /** Opt-in to cross-posting new reels/builds to AlterCosPlay brand social accounts */
  socialCrosspostOptIn: integer("social_crosspost_opt_in").default(1),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const pendingSignups = sqliteTable("pending_signups", {
  id: text("id").primaryKey(),
  username: text("username").notNull(),
  email: text("email"),
  phone: text("phone"),
  passwordHash: text("password_hash").notNull(),
  roleFlags: text("role_flags").default("cosplayer"),
  channel: text("channel").notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  attempts: integer("attempts").default(0),
  lastSentAt: integer("last_sent_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const profiles = sqliteTable("profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name"),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  linksJson: text("links_json"),
  privacySettings: text("privacy_settings").default("{}"),
  city: text("city"),
  country: text("country"),
  commissionStatus: text("commission_status").default("open"),
  lastSeen: integer("last_seen", { mode: "timestamp" }),
  isVerified: integer("is_verified", { mode: "boolean" }).default(false),
  isPrivate: integer("is_private", { mode: "boolean" }).default(false),
  coverUrl: text("cover_url"),
  phone: text("phone"),
  languagesJson: text("languages_json"),
  specializationsJson: text("specializations_json"),
  availability: text("availability").default("open"),
  maxActiveOrders: integer("max_active_orders").default(4),
  dateOfBirth: text("date_of_birth"),
  showAge: integer("show_age", { mode: "boolean" }).default(false),
  commissionComplexity: text("commission_complexity"),
  commissionTypes: text("commission_types"),
  commissionDuration: text("commission_duration"),
  priceMin: integer("price_min"),
  priceMax: integer("price_max"),
  eventsJson: text("events_json"),
  experienceYears: integer("experience_years"),
  materialsJson: text("materials_json"),
  uiLocale: text("ui_locale"),
  uiCurrency: text("ui_currency"),
  staffRole: text("staff_role").default("none"), // none | admin | owner
  staffBadgeHidden: integer("staff_badge_hidden", { mode: "boolean" }).default(false),
});

// ─── Builds & Content ───────────────────────────────────────

export const builds = sqliteTable("builds", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  franchise: text("franchise"),
  character: text("character"),
  coverImageUrl: text("cover_image_url"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  likesCount: integer("likes_count").default(0),
  commentsCount: integer("comments_count").default(0),
  year: integer("year"),
  price: integer("price").default(0),
  currency: text("currency").default("UZS"),
  category: text("category"),
  tagsJson: text("tags_json"),
  commissionStatus: text("commission_status"),
  hidden: integer("hidden", { mode: "boolean" }).default(false),
  description: text("description"),
  workType: text("work_type"),
});

export const buildPhotos = sqliteTable("build_photos", {
  id: text("id").primaryKey(),
  buildId: text("build_id")
    .notNull()
    .references(() => builds.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
  makerId: text("maker_id").references(() => users.id),
  photographerId: text("photographer_id").references(() => users.id),
  consentStatus: text("consent_status").default("pending"),
});

export const stories = sqliteTable("stories", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  buildId: text("build_id").references(() => builds.id),
  text: text("text").notNull(),
  mediaUrl: text("media_url"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const publications = sqliteTable("publications", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  caption: text("caption"),
  mediaJson: text("media_json").notNull().default("[]"),
  tagsJson: text("tags_json").default("[]"),
  kind: text("kind").notNull(), // 'post' | 'story'
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  likesCount: integer("likes_count").default(0),
  commentsCount: integer("comments_count").default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const comments = sqliteTable("comments", {
  id: text("id").primaryKey(),
  targetType: text("target_type").notNull(), // 'build' | 'publication'
  targetId: text("target_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  parentId: text("parent_id"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const publicationMentions = sqliteTable("publication_mentions", {
  id: text("id").primaryKey(),
  publicationId: text("publication_id")
    .notNull()
    .references(() => publications.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id),
  displayName: text("display_name").notNull(),
  type: text("type").notNull(), // 'user' | 'person'
});

// ─── Commissions & Orders ───────────────────────────────────

export const commissions = sqliteTable("commissions", {
  id: text("id").primaryKey(),
  makerId: text("maker_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  priceFrom: integer("price_from"),
  turnaroundDays: integer("turnaround_days"),
  status: text("status").default("open"),
});

export const commissionRequests = sqliteTable("commission_requests", {
  id: text("id").primaryKey(),
  commissionId: text("commission_id")
    .notNull()
    .references(() => commissions.id, { onDelete: "cascade" }),
  requesterUserId: text("requester_user_id").references(() => users.id),
  contact: text("contact"),
  referencesJson: text("references_json"),
  measurementsJson: text("measurements_json"),
  status: text("status").default("new"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  commissionRequestId: text("commission_request_id")
    .notNull()
    .references(() => commissionRequests.id, { onDelete: "cascade" }),
  makerId: text("maker_id")
    .notNull()
    .references(() => users.id),
  status: text("status").default("new"),
  depositAmount: real("deposit_amount"),
  depositPaid: integer("deposit_paid", { mode: "boolean" }).default(false),
  deadline: integer("deadline", { mode: "timestamp" }),
  title: text("title"),
  character: text("character"),
  franchise: text("franchise"),
  clientId: text("client_id"),
  budget: real("budget"),
  paidAmount: real("paid_amount"),
  remainingAmount: real("remaining_amount"),
  notes: text("notes"),
  coverImage: text("cover_image"),
  checklistJson: text("checklist_json"),
  activityJson: text("activity_json"),
  filesJson: text("files_json"),
  pinned: integer("pinned", { mode: "boolean" }).default(false),
  trackingNumber: text("tracking_number"),
  carrier: text("carrier"),
  cancelReason: text("cancel_reason"),
  conversationId: text("conversation_id"),
});

export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  amount: real("amount").notNull(),
  kind: text("kind").notNull(), // partial | deposit | full
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const orderStatusHistory = sqliteTable("order_status_history", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  note: text("note"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const calendarEvents = sqliteTable("calendar_events", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  startsAt: integer("starts_at", { mode: "timestamp" }).notNull(),
  endsAt: integer("ends_at", { mode: "timestamp" }),
  note: text("note"),
  orderId: text("order_id"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const accountNotificationSettings = sqliteTable("account_notification_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  orders: integer("orders", { mode: "boolean" }).default(true),
  messages: integer("messages", { mode: "boolean" }).default(true),
  likes: integer("likes", { mode: "boolean" }).default(true),
  follows: integer("follows", { mode: "boolean" }).default(true),
  email: integer("email", { mode: "boolean" }).default(false),
});

export const publicationLikes = sqliteTable("publication_likes", {
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  publicationId: text("publication_id")
    .notNull()
    .references(() => publications.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const passwordResets = sqliteTable("password_resets", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  channel: text("channel").notNull(),
  target: text("target").notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  attempts: integer("attempts").default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const revokedTokens = sqliteTable("revoked_tokens", {
  jti: text("jti").primaryKey(),
  userId: text("user_id").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
});

export const clientNotes = sqliteTable("client_notes", {
  makerId: text("maker_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  clientId: text("client_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  note: text("note"),
});

export const withdrawals = sqliteTable("withdrawals", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  amount: real("amount").notNull(),
  method: text("method").notNull(),
  details: text("details"),
  status: text("status").default("pending"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ─── Credits & Consent ──────────────────────────────────────

export const credits = sqliteTable("credits", {
  id: text("id").primaryKey(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  creditedUserId: text("credited_user_id")
    .notNull()
    .references(() => users.id),
  role: text("role").notNull(),
  confirmed: integer("confirmed", { mode: "boolean" }).default(false),
});

// ─── Notifications ──────────────────────────────────────────

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  payloadJson: text("payload_json"),
  read: integer("read", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ─── Subscriptions (disabled on launch) ─────────────────────

export const subscriptions = sqliteTable("subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  plan: text("plan").notNull(),
  status: text("status").default("inactive"),
  startedAt: integer("started_at", { mode: "timestamp" }),
});

// ─── Chat (specChat.md §5) ─────────────────────────────────

export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  type: text("type").notNull(), // 'dm' | 'channel'
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const conversationSettings = sqliteTable("conversation_settings", {
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  muted: integer("muted", { mode: "boolean" }).default(false),
  pinned: integer("pinned", { mode: "boolean" }).default(false),
});

export const conversationMembers = sqliteTable("conversation_members", {
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role").default("member"),
  joinedAt: integer("joined_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  lastReadAt: integer("last_read_at", { mode: "timestamp" }),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  senderId: text("sender_id")
    .notNull()
    .references(() => users.id),
  text: text("text"),
  mediaUrl: text("media_url"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  deleted: integer("deleted", { mode: "boolean" }).default(false),
  type: text("type").default("text"),
  duration: integer("duration"),
  fileName: text("file_name"),
  fileSize: integer("file_size"),
  replyTo: text("reply_to"),
  reactionsJson: text("reactions_json"),
  editedAt: integer("edited_at", { mode: "timestamp" }),
  status: text("status").default("sent"),
});

export const channels = sqliteTable("channels", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // 'franchise' | 'convention' | 'location'
  title: text("title").notNull(),
  relatedFranchise: text("related_franchise"),
  relatedEventDate: integer("related_event_date", { mode: "timestamp" }),
  archived: integer("archived", { mode: "boolean" }).default(false),
  writeMode: text("write_mode").default("members"), // members | owner_only | channel_admins
  sortOrder: integer("sort_order").default(0),
  managerIdsJson: text("manager_ids_json"),
});

export const reports = sqliteTable("reports", {
  id: text("id").primaryKey(),
  targetType: text("target_type").notNull(), // 'message' | 'user' | 'channel'
  targetId: text("target_id").notNull(),
  reporterId: text("reporter_id")
    .notNull()
    .references(() => users.id),
  reason: text("reason").notNull(),
  details: text("details"),
  filesJson: text("files_json"),
  status: text("status").default("pending"),
  assignedTo: text("assigned_to").references(() => users.id),
  assignedAt: integer("assigned_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const blocks = sqliteTable("blocks", {
  blockerId: text("blocker_id")
    .notNull()
    .references(() => users.id),
  blockedId: text("blocked_id")
    .notNull()
    .references(() => users.id),
  reason: text("reason"),
  details: text("details"),
  filesJson: text("files_json"),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  source: text("source").default("manual"), // manual | blacklist
  createdBy: text("created_by").references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const adminPermissions = sqliteTable("admin_permissions", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  canViewUsers: integer("can_view_users", { mode: "boolean" }).default(true),
  canViewReports: integer("can_view_reports", { mode: "boolean" }).default(true),
  canViewOrders: integer("can_view_orders", { mode: "boolean" }).default(true),
  canViewChats: integer("can_view_chats", { mode: "boolean" }).default(true),
  canViewFinance: integer("can_view_finance", { mode: "boolean" }).default(false),
  canManageStaff: integer("can_manage_staff", { mode: "boolean" }).default(false),
  canUseBlacklist: integer("can_use_blacklist", { mode: "boolean" }).default(false),
  updatedBy: text("updated_by").references(() => users.id),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  actorId: text("actor_id").references(() => users.id),
  targetType: text("target_type").notNull(), // user|message|order|channel|staff
  targetId: text("target_id").notNull(),
  severity: text("severity").default("info"), // info|warn|high
  payloadJson: text("payload_json"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const moderationSettings = sqliteTable("moderation_settings", {
  id: text("id").primaryKey(),
  autoEscalateEnabled: integer("auto_escalate_enabled", { mode: "boolean" }).default(true),
  autoEscalateIntervalMs: integer("auto_escalate_interval_ms").default(300000),
  escalationCooldownMs: integer("escalation_cooldown_ms").default(21600000),
  updatedBy: text("updated_by").references(() => users.id),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const follows = sqliteTable("follows", {
  followerId: text("follower_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  followingId: text("following_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const buildLikes = sqliteTable("build_likes", {
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  buildId: text("build_id")
    .notNull()
    .references(() => builds.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ─── Partners & advertising ─────────────────────────────────

export const partners = sqliteTable("partners", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  type: text("type").notNull(), // fest | atelier | studio | media
  name: text("name").notNull(),
  city: text("city"),
  country: text("country"),
  logoUrl: text("logo_url"),
  coverUrl: text("cover_url"),
  description: text("description"),
  contactEmail: text("contact_email"),
  websiteUrl: text("website_url"),
  status: text("status").default("draft"), // draft | pending | active | paused | archived
  packageTier: text("package_tier"),
  contractRef: text("contract_ref"),
  activeFrom: integer("active_from", { mode: "timestamp" }),
  activeUntil: integer("active_until", { mode: "timestamp" }),
  featuresJson: text("features_json").default("{}"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const partnerApplications = sqliteTable("partner_applications", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  city: text("city"),
  contactName: text("contact_name").notNull(),
  contactEmail: text("contact_email").notNull(),
  message: text("message"),
  status: text("status").default("new"), // new | reviewing | approved | rejected
  reviewedBy: text("reviewed_by").references(() => users.id),
  reviewedAt: integer("reviewed_at", { mode: "timestamp" }),
  partnerId: text("partner_id").references(() => partners.id),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const partnerMembers = sqliteTable("partner_members", {
  partnerId: text("partner_id")
    .notNull()
    .references(() => partners.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role").default("editor"), // owner | editor
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const partnerMakers = sqliteTable("partner_makers", {
  id: text("id").primaryKey(),
  partnerId: text("partner_id")
    .notNull()
    .references(() => partners.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").default(0),
  badgeLabel: text("badge_label"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const rentalItems = sqliteTable("rental_items", {
  id: text("id").primaryKey(),
  partnerId: text("partner_id")
    .notNull()
    .references(() => partners.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  photosJson: text("photos_json").default("[]"),
  price: integer("price"),
  currency: text("currency").default("UZS"),
  size: text("size"),
  franchise: text("franchise"),
  availableFrom: integer("available_from", { mode: "timestamp" }),
  availableTo: integer("available_to", { mode: "timestamp" }),
  status: text("status").default("active"), // active | hidden
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const partnerEvents = sqliteTable("partner_events", {
  id: text("id").primaryKey(),
  partnerId: text("partner_id")
    .notNull()
    .references(() => partners.id, { onDelete: "cascade" }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  city: text("city"),
  startsAt: integer("starts_at", { mode: "timestamp" }),
  endsAt: integer("ends_at", { mode: "timestamp" }),
  channelId: text("channel_id").references(() => channels.id),
  coverUrl: text("cover_url"),
  programJson: text("program_json").default("[]"),
  linksJson: text("links_json").default("[]"),
  status: text("status").default("draft"), // draft | active | archived
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const adCampaigns = sqliteTable("ad_campaigns", {
  id: text("id").primaryKey(),
  partnerId: text("partner_id")
    .notNull()
    .references(() => partners.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  status: text("status").default("draft"), // draft | scheduled | active | paused | ended
  startsAt: integer("starts_at", { mode: "timestamp" }),
  endsAt: integer("ends_at", { mode: "timestamp" }),
  targetingJson: text("targeting_json").default("{}"),
  budgetCents: integer("budget_cents"),
  packageTier: text("package_tier"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const adPlacements = sqliteTable("ad_placements", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id")
    .notNull()
    .references(() => adCampaigns.id, { onDelete: "cascade" }),
  slotId: text("slot_id").notNull(),
  creativeJson: text("creative_json").notNull(),
  sortOrder: integer("sort_order").default(0),
  weight: integer("weight").default(100),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const appKv = sqliteTable("app_kv", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** Role change / other moderation requests from users */
export const moderationRequests = sqliteTable("moderation_requests", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("role_change"), // role_change
  currentRole: text("current_role"),
  requestedRole: text("requested_role").notNull(),
  reason: text("reason").notNull(),
  activityExplanation: text("activity_explanation").notNull(),
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  reviewerId: text("reviewer_id").references(() => users.id),
  reviewNote: text("review_note"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  reviewedAt: integer("reviewed_at", { mode: "timestamp" }),
});

export const adEvents = sqliteTable("ad_events", {
  id: text("id").primaryKey(),
  placementId: text("placement_id")
    .notNull()
    .references(() => adPlacements.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // impression | click
  userId: text("user_id").references(() => users.id),
  sessionId: text("session_id"),
  city: text("city"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ─── Social auto-publish ────────────────────────────────────

export const socialModeration = sqliteTable(
  "social_moderation",
  {
    id: text("id").primaryKey(),
    /** 'publication' | 'build' */
    contentType: text("content_type").notNull(),
    contentId: text("content_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"), // pending | approved | rejected | review
    confidence: text("confidence"), // high | medium | low
    reason: text("reason"),
    geminiModel: text("gemini_model"),
    geminiRawJson: text("gemini_raw_json"),
    reviewedBy: text("reviewed_by").references(() => users.id),
    reviewedAt: integer("reviewed_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [unique("social_moderation_content_unique").on(table.contentType, table.contentId)]
);

export const socialJobs = sqliteTable("social_jobs", {
  id: text("id").primaryKey(),
  /** moderate | publish | sync | tiktok_public_repost */
  kind: text("kind").notNull(),
  /** youtube | instagram | facebook | tiktok | null for moderate */
  platform: text("platform"),
  contentType: text("content_type").notNull(),
  contentId: text("content_id").notNull(),
  status: text("status").notNull().default("queued"), // queued | running | done | failed | deferred
  attempts: integer("attempts").default(0),
  maxAttempts: integer("max_attempts").default(5),
  runAfter: integer("run_after", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  lockedAt: integer("locked_at", { mode: "timestamp" }),
  lastError: text("last_error"),
  payloadJson: text("payload_json"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const socialPosts = sqliteTable(
  "social_posts",
  {
    id: text("id").primaryKey(),
    contentType: text("content_type").notNull(),
    contentId: text("content_id").notNull(),
    platform: text("platform").notNull(), // youtube | instagram | facebook | tiktok
    status: text("status").notNull(), // queued | publishing | published | failed | private_pending_audit | superseded
    externalId: text("external_id"),
    externalUrl: text("external_url"),
    tiktokVisibility: text("tiktok_visibility"), // private_pending_audit | public
    tiktokLegacyPublishId: text("tiktok_legacy_publish_id"),
    sourceMediaUrl: text("source_media_url"),
    title: text("title"),
    description: text("description"),
    hashtagsJson: text("hashtags_json"),
    likesCount: integer("likes_count").default(0),
    commentsCount: integer("comments_count").default(0),
    lastSyncedAt: integer("last_synced_at", { mode: "timestamp" }),
    publishedAt: integer("published_at", { mode: "timestamp" }),
    error: text("error"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    unique("social_posts_content_platform_unique").on(table.contentType, table.contentId, table.platform),
  ]
);

export const socialOauthTokens = sqliteTable("social_oauth_tokens", {
  provider: text("provider").primaryKey(), // youtube | meta | tiktok
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  extraJson: text("extra_json"),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
