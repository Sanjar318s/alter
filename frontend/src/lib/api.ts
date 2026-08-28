const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("alter_token") : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    cache: "no-store",
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const e = new Error(err.error || "Request failed") as Error & { status?: number };
    e.status = res.status;
    throw e;
  }

  return res.json();
}

// Auth
export const auth = {
  register: (data: {
    username: string;
    password: string;
    roleFlags?: string;
    method: "email" | "phone";
    email?: string;
    phone?: string;
  }) =>
    request<{
      pendingId: string;
      channel: "email" | "phone";
      maskedTarget: string;
      expiresIn: number;
      resendIn: number;
      devCode?: string;
    }>("/api/auth/register", { method: "POST", body: JSON.stringify(data) }),
  verify: (data: { pendingId: string; code: string }) =>
    request<{ token: string; user: { id: string; email: string; username: string } }>(
      "/api/auth/verify",
      { method: "POST", body: JSON.stringify(data) }
    ),
  resend: (data: { pendingId: string }) =>
    request<{
      pendingId: string;
      channel: "email" | "phone";
      maskedTarget: string;
      expiresIn: number;
      resendIn: number;
      devCode?: string;
    }>("/api/auth/resend", { method: "POST", body: JSON.stringify(data) }),
  login: (data: { email?: string; phone?: string; password: string }) =>
    request<{ token: string; user: { id: string; email: string; username: string } }>(
      "/api/auth/login",
      { method: "POST", body: JSON.stringify(data) }
    ),
  me: () =>
    request<{ user: any; profile: any }>("/api/auth/me"),
  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  resetRequest: (data: { email?: string; phone?: string }) =>
    request<{ ok: boolean; resetId?: string; channel?: string; maskedTarget?: string; devCode?: string }>(
      "/api/auth/reset/request",
      { method: "POST", body: JSON.stringify(data) }
    ),
  resetConfirm: (data: { resetId: string; code: string; newPassword: string }) =>
    request<{ ok: boolean }>("/api/auth/reset/confirm", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// Users / Profiles
export const users = {
  get: (username: string) =>
    request<{
      user: any;
      profile: any;
      builds: any[];
      stories: any[];
      commissions: any[];
      events?: any[];
      stats?: any;
      isFollowing?: boolean;
      isOwner?: boolean;
      isPrivate?: boolean;
    }>(`/api/users/${username}`),
  updateProfile: (username: string, data: Record<string, any>) =>
    request<{ profile: any }>(`/api/users/${username}/profile`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  follow: (username: string) =>
    request<{ ok: boolean; stats?: { builds: number; followers: number; following: number; likes: number; orders: number } }>(
      `/api/users/${username}/follow`,
      { method: "POST" }
    ),
  unfollow: (username: string) =>
    request<{ ok: boolean; stats?: { builds: number; followers: number; following: number; likes: number; orders: number } }>(
      `/api/users/${username}/follow`,
      { method: "DELETE" }
    ),
  events: (username: string) =>
    request<{ events: any[] }>(`/api/users/${username}/events`),
  saveEvents: (username: string, events: any[]) =>
    request<{ events: any[] }>(`/api/users/${username}/events`, {
      method: "PUT",
      body: JSON.stringify({ events }),
    }),
  search: (q: string) =>
    request<{ users: { id: string; username: string; displayName?: string; avatarUrl?: string }[] }>(
      `/api/users/search?q=${encodeURIComponent(q)}`
    ),
  followers: (username: string) =>
    request<{ users: any[] }>(`/api/users/${username}/followers`),
  following: (username: string) =>
    request<{ users: any[] }>(`/api/users/${username}/following`),
  stats: (username: string) => request<{ stats: any }>(`/api/users/${username}/stats`),
  orders: (username: string) =>
    request<{ orders: any[]; avgBudget: number | null; deadlineCount: number }>(`/api/users/${username}/orders`),
  activity: (username: string) => request<{ activity: number[] }>(`/api/users/${username}/activity`),
};

export const explore = {
  list: (params: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "") qs.set(k, String(v));
    });
    return request<{
      data: any[];
      nextCursor: number | null;
      total: number;
      categories: { id: string; name: string; slug: string; count: number }[];
      statuses: Record<string, number>;
    }>(`/api/explore?${qs.toString()}`);
  },
};

export const account = {
  usernameAvailable: (username: string) =>
    request<{ available: boolean }>(
      `/api/account/username-available?username=${encodeURIComponent(username)}`
    ),
  patch: (data: Record<string, any>) =>
    request<{ user: any; profile: any }>("/api/account/profile", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  password: (data: { currentPassword: string; newPassword: string }) =>
    request<{ ok: boolean }>("/api/account/password", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  export: () => request<any>("/api/account/export"),
  delete: () =>
    request<{ ok: boolean }>("/api/account", {
      method: "DELETE",
      body: JSON.stringify({ confirm: "DELETE" }),
    }),
  notificationSettings: () => request<{ settings: any }>("/api/account/notification-settings"),
  patchNotificationSettings: (data: Record<string, boolean>) =>
    request<{ settings: any }>("/api/account/notification-settings", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  privacy: () => request<{ settings: any }>("/api/account/privacy"),
  patchPrivacy: (data: Record<string, string>) =>
    request<{ settings: any }>("/api/account/privacy", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  blocked: () => request<{ users: any[] }>("/api/account/blocked"),
  completeness: () => request<{ percent: number; checks: Record<string, boolean> }>("/api/account/completeness"),
  premium: () =>
    request<{
      progress: {
        youtubeReelsAt1M: number;
        youtubeReelsNeeded: number;
        platformViews: number;
        platformViewsNeeded: number;
        platformComments: number;
        platformCommentsNeeded: number;
        qualifies: boolean;
        activeGrant: { id: string; startsAt: string; endsAt: string } | null;
      } | null;
      message?: string;
    }>("/api/account/premium"),
  roleChangeRequests: () =>
    request<{ requests: any[] }>("/api/account/role-change-requests"),
  createRoleChangeRequest: (data: {
    requestedRole: string;
    reason: string;
    activityExplanation: string;
  }) =>
    request<{ request: any }>("/api/account/role-change-requests", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

export async function uploadFile(file: Blob, fileName: string, mime: string) {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("alter_token") : null;
  let body: Blob = file;
  let type = mime;
  let name = fileName;
  if (typeof File !== "undefined" && file instanceof File && file.type.startsWith("image/") && file.type !== "image/gif") {
    const { compressImage } = await import("./compressImage");
    body = await compressImage(file);
    type = body.type || "image/jpeg";
    if (type === "image/jpeg" && !name.toLowerCase().endsWith(".jpg") && !name.toLowerCase().endsWith(".jpeg")) {
      name = name.replace(/\.[^.]+$/, "") + ".jpg";
    }
  }
  const res = await fetch(`${API_URL}/api/upload`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": type,
      "X-File-Name": encodeURIComponent(name),
      "X-File-Type": type,
    },
    body,
  });
  if (!res.ok) throw new Error("Upload failed");
  return res.json() as Promise<{ url: string; fileName: string; fileSize: number }>;
}

// Builds
export const builds = {
  list: (params?: { franchise?: string; userId?: string }) => {
    const qs = new URLSearchParams(params as any).toString();
    return request<{ builds: any[] }>(`/api/builds${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) =>
    request<{ build: any; photos: any[]; credits: any[]; author: any; isOwner: boolean; liked: boolean }>(
      `/api/builds/${id}`
    ),
  create: (data: Record<string, unknown>) =>
    request<{ build: any; photos: any[]; credits: any[] }>("/api/builds", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Record<string, unknown>) =>
    request<{ build: any }>(`/api/builds/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  remove: (id: string) => request<{ ok: boolean }>(`/api/builds/${id}`, { method: "DELETE" }),
  addPhoto: (id: string, data: { imageUrl: string; makerId?: string; photographerId?: string }) =>
    request<{ photo: any }>(`/api/builds/${id}/photos`, { method: "POST", body: JSON.stringify(data) }),
  consent: (id: string, photoId: string, decision: "approve" | "reject") =>
    request<{ ok: boolean }>(`/api/builds/${id}/photos/${photoId}/consent`, {
      method: "POST",
      body: JSON.stringify({ decision }),
    }),
  like: (id: string) =>
    request<{ liked: boolean; likesCount: number }>(`/api/builds/${id}/like`, { method: "POST" }),
  unlike: (id: string) =>
    request<{ liked: boolean; likesCount: number }>(`/api/builds/${id}/like`, { method: "DELETE" }),
};

// Commissions
export const commissions = {
  list: () => request<{ commissions: any[] }>("/api/commissions"),
  get: (id: string) =>
    request<{ commission: any; maker: any }>(`/api/commissions/${id}`),
  create: (data: { title: string; description?: string; priceFrom?: number; turnaroundDays?: number }) =>
    request<{ commission: any }>("/api/commissions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  request: (commissionId: string, data: Record<string, unknown>) =>
    request<{ request: any; conversationId: string; orderId: string }>(
      `/api/commissions/${commissionId}/request`,
      { method: "POST", body: JSON.stringify(data) }
    ),
};

export const orders = {
  withGhost: (base: string, params?: { ghost?: boolean; intervene?: boolean; targetUser?: string }) => {
    const qs = new URLSearchParams();
    if (params?.ghost) qs.set("ghost", "1");
    if (params?.intervene) qs.set("intervene", "1");
    if (params?.targetUser) qs.set("targetUser", params.targetUser);
    return `${base}${qs.toString() ? `?${qs.toString()}` : ""}`;
  },
  list: (params?: { ghost?: boolean; targetUser?: string }) => {
    const qs = new URLSearchParams();
    if (params?.ghost) qs.set("ghost", "1");
    if (params?.targetUser) qs.set("targetUser", params.targetUser);
    return request<{ orders: any[] }>(`/api/orders${qs.toString() ? `?${qs.toString()}` : ""}`);
  },
  create: (data: Record<string, unknown>) =>
    request<{ order: any }>("/api/orders", { method: "POST", body: JSON.stringify(data) }),
  get: (id: string, params?: { ghost?: boolean; intervene?: boolean; targetUser?: string }) =>
    request<{ order: any }>(orders.withGhost(`/api/orders/${id}`, params)),
  update: (id: string, data: Record<string, unknown>, params?: { ghost?: boolean; intervene?: boolean; targetUser?: string }) =>
    request<{ order: any }>(orders.withGhost(`/api/orders/${id}`, params), { method: "PATCH", body: JSON.stringify(data) }),
  pay: (id: string, data: { amount: number; kind: string }, params?: { ghost?: boolean; intervene?: boolean; targetUser?: string }) =>
    request<{ order: any }>(orders.withGhost(`/api/orders/${id}/payments`, params), { method: "POST", body: JSON.stringify(data) }),
  clients: () => request<{ clients: any[] }>("/api/orders/clients"),
  clientNote: (userId: string, note: string) =>
    request<{ ok: boolean }>(`/api/orders/clients/${userId}/note`, {
      method: "PATCH",
      body: JSON.stringify({ note }),
    }),
  decide: (id: string, data: { action: "accept" | "wait" | "reject" | "confirm_wait"; reason?: string; details?: string }, params?: { ghost?: boolean; intervene?: boolean; targetUser?: string }) =>
    request<{ order: any }>(orders.withGhost(`/api/orders/${id}/decision`, params), {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

export const finance = {
  transactions: () => request<any>("/api/finance/transactions"),
  withdraw: (data: { amount: number; method: string; details: string }) =>
    request<{ withdrawal: any; message: string }>("/api/finance/withdrawals", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

export const analytics = {
  studio: (period: string) => request<any>(`/api/analytics/studio?period=${period}`),
};

export const calendar = {
  list: (from?: string, to?: string) => {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    return request<{ events: any[]; deadlines: any[] }>(`/api/calendar/events?${qs}`);
  },
  create: (data: Record<string, unknown>) =>
    request<{ event: any }>("/api/calendar/events", { method: "POST", body: JSON.stringify(data) }),
  remove: (id: string) => request<{ ok: boolean }>(`/api/calendar/events/${id}`, { method: "DELETE" }),
};

export const health = {
  get: () =>
    request<{
      status: string;
      workers?: Record<string, string>;
      paymentsLive?: boolean;
      socialOAuthConfigured?: Record<string, boolean>;
    }>("/api/health"),
};

export const admin = {
  buildAuditCsvUrl: (params?: { type?: string; severity?: string; actor?: string; q?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.type) qs.set("type", params.type);
    if (params?.severity) qs.set("severity", params.severity);
    if (params?.actor) qs.set("actor", params.actor);
    if (params?.q) qs.set("q", params.q);
    if (params?.limit) qs.set("limit", String(params.limit));
    return `${API_URL}/api/admin/audit/export.csv${qs.toString() ? `?${qs.toString()}` : ""}`;
  },
  auditEvents: (params?: { type?: string; severity?: string; actor?: string; q?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.type) qs.set("type", params.type);
    if (params?.severity) qs.set("severity", params.severity);
    if (params?.actor) qs.set("actor", params.actor);
    if (params?.q) qs.set("q", params.q);
    if (params?.limit) qs.set("limit", String(params.limit));
    return request<{ events: any[] }>(`/api/admin/audit${qs.toString() ? `?${qs.toString()}` : ""}`);
  },
  me: () => request<{ isOwner: boolean; permissions: Record<string, boolean> }>("/api/admin/permissions/me"),
  reports: () => request<{ reports: any[]; queue: any; queueItems: any[] }>("/api/admin/reports"),
  patchReport: (id: string, status: string) =>
    request<{ ok: boolean }>(`/api/admin/reports/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
  assignReport: (id: string, assigneeId?: string) =>
    request<{ ok: boolean }>(`/api/admin/reports/${id}/assign`, {
      method: "POST",
      body: JSON.stringify({ assigneeId }),
    }),
  unassignReport: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/reports/${id}/unassign`, { method: "POST" }),
  escalateOverdueReports: () =>
    request<{ ok: boolean; escalated: number; affected: string[] }>("/api/admin/reports/escalate-overdue", {
      method: "POST",
    }),
  roleChangeRequests: (status = "pending") =>
    request<{ requests: any[] }>(`/api/admin/role-change-requests?status=${encodeURIComponent(status)}`),
  approveRoleChange: (id: string, note?: string) =>
    request<{ ok: boolean }>(`/api/admin/role-change-requests/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ note }),
    }),
  rejectRoleChange: (id: string, note?: string) =>
    request<{ ok: boolean }>(`/api/admin/role-change-requests/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ note }),
    }),
  withdrawals: () => request<{ withdrawals: any[] }>("/api/admin/withdrawals"),
  patchWithdrawal: (id: string, status: string) =>
    request<{ ok: boolean }>(`/api/admin/withdrawals/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
  users: (query?: string) => request<{ users: any[] }>(`/api/admin/users${query ? `?query=${encodeURIComponent(query)}` : ""}`),
  userSummary: (id: string) => request<any>(`/api/admin/users/${id}/summary`),
  staff: () => request<{ ownerUsername: string; admins: any[] }>("/api/admin/staff"),
  setStaffRole: (userId: string, makeAdmin: boolean) =>
    request<{ ok: boolean }>(`/api/admin/staff/${userId}`, { method: "PATCH", body: JSON.stringify({ makeAdmin }) }),
  setStaffPermissions: (userId: string, permissions: Record<string, boolean>) =>
    request<{ ok: boolean; permissions: any }>(`/api/admin/staff/${userId}/permissions`, {
      method: "PATCH",
      body: JSON.stringify(permissions),
    }),
  setBadgeHidden: (userId: string, hidden: boolean) =>
    request<{ ok: boolean; hidden: boolean }>(`/api/admin/staff/${userId}/badge`, {
      method: "PATCH",
      body: JSON.stringify({ hidden }),
    }),
  unblockUser: (userId: string) =>
    request<{ ok: boolean }>(`/api/admin/users/${userId}/unblock`, { method: "POST" }),
  moderationSettings: () =>
    request<{ settings: { autoEscalateEnabled: boolean; autoEscalateIntervalMs: number; escalationCooldownMs: number } }>(
      "/api/admin/moderation/settings"
    ),
  patchModerationSettings: (data: Partial<{ autoEscalateEnabled: boolean; autoEscalateIntervalMs: number; escalationCooldownMs: number }>) =>
    request<{ ok: boolean; settings: any }>("/api/admin/moderation/settings", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  moderationSettingsHistory: () =>
    request<{ history: Array<{ id: string; createdAt: string; actor?: { id: string; username: string } | null; payload?: any }> }>(
      "/api/admin/moderation/settings/history"
    ),
};

export const adminSocial = {
  review: () => request<{ items: any[]; rejected: any[] }>("/api/admin/social/review"),
  reviewDecision: (id: string, decision: "approved" | "rejected", note?: string) =>
    request<{ ok: boolean }>(`/api/admin/social/review/${id}`, {
      method: "POST",
      body: JSON.stringify({ decision, note }),
    }),
  settings: () =>
    request<{
      settings: {
        tiktokAuditApproved: boolean;
        metaLiveMode: boolean;
        youtubeDailyUploadCap: number;
        publishYoutube: boolean;
        publishTiktok: boolean;
        publishInstagram: boolean;
        publishFacebook: boolean;
      };
      publishPlatforms: { publication: string[]; build: string[] };
      oauth: { youtube: boolean; meta: boolean; tiktok: boolean };
    }>("/api/admin/social/settings"),
  patchSettings: (
    data: Partial<{
      tiktokAuditApproved: boolean;
      metaLiveMode: boolean;
      youtubeDailyUploadCap: number;
      publishYoutube: boolean;
      publishTiktok: boolean;
      publishInstagram: boolean;
      publishFacebook: boolean;
    }>
  ) =>
    request<{ settings: any }>("/api/admin/social/settings", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  syncNow: () => request<{ ok: boolean; synced: number }>("/api/admin/social/sync-now", { method: "POST" }),
  posts: () => request<{ posts: any[] }>("/api/admin/social/posts"),
  tiktokRepublishPublic: () =>
    request<{ ok: boolean; queued: number }>("/api/admin/social/tiktok/republish-public", { method: "POST" }),
};

// Partners & placements
export const partners = {
  list: (params?: { type?: string; city?: string }) => {
    const qs = new URLSearchParams();
    if (params?.type) qs.set("type", params.type);
    if (params?.city) qs.set("city", params.city);
    return request<{ partners: PartnerPublic[] }>(`/api/partners${qs.toString() ? `?${qs}` : ""}`);
  },
  get: (slug: string) => request<{ partner: PartnerPublic }>(`/api/partners/${encodeURIComponent(slug)}`),
  events: () => request<{ events: PartnerEventListItem[] }>("/api/partners/events"),
  event: (slug: string) => request<{ event: PartnerEventDetail }>(`/api/partners/events/${encodeURIComponent(slug)}`),
  apply: (data: { type: string; city?: string; contactName: string; contactEmail: string; message?: string }) =>
    request<{ ok: boolean; applicationId: string }>("/api/partners/applications", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  makerBadges: (userId: string) =>
    request<{ badges: { partnerSlug: string; partnerName: string; badgeLabel: string }[] }>(
      `/api/partners/makers/${encodeURIComponent(userId)}/badges`
    ),
};

export type PartnerPublic = {
  id: string;
  slug: string;
  type: string;
  name: string;
  city?: string;
  country?: string;
  logoUrl?: string;
  coverUrl?: string;
  description?: string;
  websiteUrl?: string;
  status?: string;
  packageTier?: string;
  contractRef?: string;
  features?: Record<string, boolean>;
  makers?: { id: string; userId: string; username?: string; avatarUrl?: string; badgeLabel?: string }[];
  rentals?: { id: string; title: string; description?: string; photos: string[]; price?: number; currency?: string; size?: string; franchise?: string }[];
  events?: PartnerEventListItem[];
};

export type PartnerEventListItem = {
  id: string;
  slug: string;
  title: string;
  city?: string;
  startsAt?: string;
  endsAt?: string;
  coverUrl?: string;
  channelId?: string;
  partner?: { slug: string; name: string; logoUrl?: string };
};

export type PartnerEventDetail = PartnerEventListItem & {
  program?: unknown[];
  links?: { label: string; url: string }[];
  partner: PartnerPublic;
};

export type AdPlacementResponse = {
  placement: {
    placementId: string;
    slotId: string;
    campaignId: string;
    partner: PartnerPublic;
    creative: {
      title: string;
      subtitle?: string;
      imageUrl?: string;
      ctaLabel?: string;
      ctaUrl?: string;
      partnerSlug?: string;
    };
  } | null;
};

export const placements = {
  get: (slot: string, city?: string) => {
    const qs = new URLSearchParams({ slot });
    if (city) qs.set("city", city);
    return request<AdPlacementResponse>(`/api/placements?${qs}`);
  },
  track: (data: { placementId: string; type: "impression" | "click"; sessionId?: string; city?: string }) =>
    request<{ ok: boolean }>("/api/placements/track", { method: "POST", body: JSON.stringify(data) }),
};

export const adminPartners = {
  applications: () => request<{ applications: PartnerApplication[] }>("/api/admin/partners/applications"),
  approveApplication: (id: string, data?: { name?: string; slug?: string; features?: Record<string, boolean> }) =>
    request<{ ok: boolean; partnerId: string; slug: string }>(`/api/admin/partners/applications/${id}/approve`, {
      method: "POST",
      body: JSON.stringify(data || {}),
    }),
  rejectApplication: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/partners/applications/${id}/reject`, { method: "POST" }),
  list: () => request<{ partners: PartnerPublic[] }>("/api/admin/partners"),
  create: (data: Record<string, unknown>) =>
    request<{ ok: boolean; partner: PartnerPublic }>("/api/admin/partners", { method: "POST", body: JSON.stringify(data) }),
  get: (id: string) => request<{ partner: PartnerPublic }>(`/api/admin/partners/${id}`),
  update: (id: string, data: Record<string, unknown>) =>
    request<{ ok: boolean; partner: PartnerPublic }>(`/api/admin/partners/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  delete: (id: string) => request<{ ok: boolean }>(`/api/admin/partners/${id}`, { method: "DELETE" }),
  addMaker: (partnerId: string, data: { userId: string; badgeLabel?: string; sortOrder?: number }) =>
    request<{ ok: boolean; id: string }>(`/api/admin/partners/${partnerId}/makers`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  removeMaker: (partnerId: string, makerRowId: string) =>
    request<{ ok: boolean }>(`/api/admin/partners/${partnerId}/makers/${makerRowId}`, { method: "DELETE" }),
  addRental: (partnerId: string, data: Record<string, unknown>) =>
    request<{ ok: boolean; id: string }>(`/api/admin/partners/${partnerId}/rentals`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  addEvent: (partnerId: string, data: Record<string, unknown>) =>
    request<{ ok: boolean; id: string; slug: string }>(`/api/admin/partners/${partnerId}/events`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  campaigns: (partnerId: string) =>
    request<{ campaigns: AdCampaign[] }>(`/api/admin/partners/${partnerId}/campaigns`),
  createCampaign: (partnerId: string, data: Record<string, unknown>) =>
    request<{ ok: boolean; id: string }>(`/api/admin/partners/${partnerId}/campaigns`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCampaign: (campaignId: string, data: Record<string, unknown>) =>
    request<{ ok: boolean }>(`/api/admin/partners/campaigns/${campaignId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  createPlacement: (campaignId: string, data: Record<string, unknown>) =>
    request<{ ok: boolean; id: string }>(`/api/admin/partners/campaigns/${campaignId}/placements`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  reportCsvUrl: (campaignId: string) => `${API_URL}/api/admin/partners/campaigns/${campaignId}/report.csv`,
  addMember: (partnerId: string, data: { userId: string; role?: string }) =>
    request<{ ok: boolean }>(`/api/admin/partners/${partnerId}/members`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

export type PartnerApplication = {
  id: string;
  type: string;
  city?: string;
  contactName: string;
  contactEmail: string;
  message?: string;
  status: string;
  createdAt: string;
};

export type AdCampaign = {
  id: string;
  name: string;
  status: string;
  startsAt?: string;
  endsAt?: string;
  stats?: { impressions: number; clicks: number; ctr: number };
};

export const partnerPortal = {
  list: () => request<{ partners: PartnerPublic[] }>("/api/partner-portal"),
  get: (partnerId: string) =>
    request<{ partner: PartnerPublic; campaigns: AdCampaign[]; memberRole: string }>(
      `/api/partner-portal/${partnerId}`
    ),
  update: (partnerId: string, data: Record<string, unknown>) =>
    request<{ ok: boolean }>(`/api/partner-portal/${partnerId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  analytics: (partnerId: string) =>
    request<{ campaigns: AdCampaign[] }>(`/api/partner-portal/${partnerId}/analytics`),
};

// Messages / Chat
export const messages = {
  conversations: () => request<{ conversations: any[] }>("/api/messages"),
  thread: (conversationId: string, before?: string, ghost?: boolean) =>
    request<{ messages: any[] }>(
      `/api/messages/${conversationId}?${[
        before ? `before=${encodeURIComponent(before)}` : "",
        ghost ? "ghost=1" : "",
      ]
        .filter(Boolean)
        .join("&")}`
    ),
  send: (conversationId: string, data: { text?: string; mediaUrl?: string; type?: string; duration?: number; fileName?: string; fileSize?: number; replyTo?: string }) =>
    request<{ message: any }>(`/api/messages/${conversationId}`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  typing: (conversationId: string) =>
    request<{ ok: boolean }>(`/api/messages/${conversationId}/typing`, { method: "POST" }),
  createConversation: (participantId: string) =>
    request<{ conversationId: string; existing: boolean }>(
      "/api/messages/conversations",
      { method: "POST", body: JSON.stringify({ participantId }) }
    ),
  channels: (opts?: { includeArchived?: boolean }) =>
    request<{ channels: any[] }>(
      `/api/messages/channels/list${opts?.includeArchived ? "?includeArchived=1" : ""}`
    ),
  manageChannel: (
    channelId: string,
    data: {
      title?: string;
      writeMode?: "members" | "owner_only" | "channel_admins";
      managerUsernames?: string[];
      move?: "up" | "down";
      archived?: boolean;
      relatedFranchise?: string | null;
      relatedEventDate?: string | null;
    }
  ) =>
    request<{ ok: boolean; channel: any }>(`/api/messages/channels/${channelId}/manage`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  reorderChannels: (kind: string, orderedIds: string[]) =>
    request<{ ok: boolean }>(`/api/messages/channels/reorder`, {
      method: "PATCH",
      body: JSON.stringify({ kind, orderedIds }),
    }),
  createChannel: (data: {
    kind: string;
    title: string;
    relatedFranchise?: string;
    relatedEventDate?: string;
  }) =>
    request<{ channelId: string; conversationId: string }>("/api/messages/channels", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteChannel: (channelId: string) =>
    request<{ ok: boolean }>(`/api/messages/channels/${channelId}`, { method: "DELETE" }),
  joinChannel: (channelId: string) =>
    request<{ ok: boolean; conversationId?: string }>(`/api/messages/channels/${channelId}/join`, {
      method: "POST",
    }),
  channelMembers: (channelId: string) =>
    request<{ members: any[]; count: number; channel?: { createdAt?: string } }>(
      `/api/messages/channels/${channelId}/members`
    ),
  leaveChannel: (channelId: string) =>
    request<{ ok: boolean }>(`/api/messages/channels/${channelId}/leave`, { method: "POST" }),
  getSettings: (conversationId: string) =>
    request<{ muted: boolean; pinned: boolean }>(`/api/messages/${conversationId}/settings`),
  report: (data: { targetType: string; targetId: string; reason: string; details?: string; files?: string[] }) =>
    request<{ reportId: string }>("/api/messages/report", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  block: (
    blockedId: string,
    extra?: { reason?: string; details?: string; files?: string[]; source?: "manual" | "blacklist"; durationHours?: number }
  ) =>
    request<{ ok: boolean }>("/api/messages/block", {
      method: "POST",
      body: JSON.stringify({
        blockedId,
        reason: extra?.reason,
        details: extra?.details,
        files: extra?.files || [],
        source: extra?.source || "manual",
        durationHours: extra?.durationHours || 0,
      }),
    }),
  unblock: (blockedId: string) =>
    request<{ ok: boolean }>(`/api/messages/block/${blockedId}`, {
      method: "DELETE",
    }),
  unreadCount: () => request<{ count: number }>("/api/messages/unread-count"),
  settings: (conversationId: string, data: { muted?: boolean; pinned?: boolean }) =>
    request<{ muted: boolean; pinned: boolean }>(`/api/messages/${conversationId}/settings`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  attachments: (conversationId: string, type?: string, ghost?: boolean) =>
    request<{ items: any[] }>(
      `/api/messages/${conversationId}/attachments?${[
        type ? `type=${encodeURIComponent(type)}` : "",
        ghost ? "ghost=1" : "",
      ]
        .filter(Boolean)
        .join("&")}`
    ),
  edit: (id: string, text: string) =>
    request<{ message: any }>(`/api/messages/m/${id}`, { method: "PATCH", body: JSON.stringify({ text }) }),
  remove: (id: string) => request<{ ok: boolean }>(`/api/messages/m/${id}`, { method: "DELETE" }),
  react: (id: string, emoji: string) =>
    request<{ reactions: Record<string, string[]> }>(`/api/messages/m/${id}/reactions`, {
      method: "POST",
      body: JSON.stringify({ emoji }),
    }),
};

// Notifications
export const notifications = {
  list: () => request<{ notifications: any[] }>("/api/notifications"),
  markRead: (id: string) =>
    request<{ ok: boolean }>(`/api/notifications/${id}/read`, { method: "PUT" }),
  markAllRead: () =>
    request<{ ok: boolean }>("/api/notifications/read-all", { method: "PUT" }),
  unreadCount: () => request<{ count: number }>("/api/notifications/unread-count"),
};

// Publications
export const publications = {
  feed: () => request<{ publications: any[] }>("/api/publications/feed"),
  list: (username: string) =>
    request<{ publications: any[] }>(`/api/publications/user/${encodeURIComponent(username)}`),
  create: (data: {
    caption?: string;
    mediaUrls: string[];
    tags?: string[];
    mentions?: { username?: string; displayName: string; type: "user" | "person" }[];
    kind?: "post" | "story";
    socialCrosspostOptIn?: boolean;
  }) =>
    request<{ publication: any }>("/api/publications", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    request<{ ok: boolean }>(`/api/publications/${id}`, { method: "DELETE" }),
  like: (id: string) =>
    request<{ liked: boolean; likesCount: number }>(`/api/publications/${id}/like`, { method: "POST" }),
  unlike: (id: string) =>
    request<{ liked: boolean; likesCount: number }>(`/api/publications/${id}/like`, { method: "DELETE" }),
  view: (id: string) =>
    request<{ counted: boolean; countedViews: number }>(`/api/publications/${id}/view`, { method: "POST" }),
};

export const comments = {
  list: (targetType: "build" | "publication", targetId: string) =>
    request<{ comments: any[] }>(
      `/api/comments?targetType=${encodeURIComponent(targetType)}&targetId=${encodeURIComponent(targetId)}`
    ),
  create: (data: {
    targetType: "build" | "publication";
    targetId: string;
    text: string;
    parentId?: string | null;
  }) =>
    request<{ comment: any }>("/api/comments", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    request<{ ok: boolean }>(`/api/comments/${id}`, { method: "DELETE" }),
};

// Stories
export const stories = {
  list: () => request<{ stories: any[] }>("/api/stories"),
  userStories: (userId: string) =>
    request<{ stories: any[] }>(`/api/stories/user/${userId}`),
  create: (data: { text: string; buildId?: string; mediaUrl?: string }) =>
    request<{ story: any }>("/api/stories", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// Credits
export const credits = {
  list: (targetType: string, targetId: string) =>
    request<{ credits: any[] }>(
      `/api/credits?targetType=${targetType}&targetId=${targetId}`
    ),
  request: (data: { targetType: string; targetId: string; creditedUserId: string; role: string }) =>
    request<{ creditId: string }>("/api/credits", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  confirm: (id: string) =>
    request<{ ok: boolean }>(`/api/credits/${id}/confirm`, { method: "PUT" }),
};

export type GifItem = {
  id: string;
  title: string;
  previewUrl: string;
  url: string;
};

export const gifs = {
  trending: () => request<{ gifs: GifItem[]; fallback?: boolean }>("/api/gifs/trending"),
  search: (q: string) =>
    request<{ gifs: GifItem[]; fallback?: boolean }>(`/api/gifs/search?q=${encodeURIComponent(q)}`),
};
