"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StudioShell } from "@/components/StudioShell";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { useAuth } from "@/lib/AuthContext";
import { isAdminUser, isPlatformOwnerUser } from "@/lib/owner";
import { admin, health, messages, uploadFile } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import dynamic from "next/dynamic";
import { useLocale } from "@/lib/LocaleContext";
import type { HelpTopic, UserSectionKey } from "@/components/admin/AdminDashboard";
import { BLOCK_REASONS } from "@/components/admin/BlockUserModal";

const AdminDashboard = dynamic(
  () => import("@/components/admin/AdminDashboard").then((m) => m.AdminDashboard),
  { ssr: false, loading: () => <SkeletonPage className="pt-6" /> }
);
const BlockUserModal = dynamic(
  () => import("@/components/admin/BlockUserModal").then((m) => m.BlockUserModal),
  { ssr: false }
);
const UserDossierModal = dynamic(
  () => import("@/components/admin/UserDossierModal").then((m) => m.UserDossierModal),
  { ssr: false }
);
const AdminRoleChangePanel = dynamic(
  () => import("@/components/admin/AdminRoleChangePanel").then((m) => m.AdminRoleChangePanel),
  { ssr: false }
);
const AdminSocialPanel = dynamic(
  () => import("@/components/admin/AdminSocialPanel").then((m) => m.AdminSocialPanel),
  { ssr: false }
);

const ROLE_PRESETS: Record<string, Record<string, boolean>> = {
  support: {
    canViewUsers: true,
    canViewReports: true,
    canViewOrders: false,
    canViewChats: true,
    canViewFinance: false,
    canManageStaff: false,
    canUseBlacklist: false,
  },
  moderator: {
    canViewUsers: true,
    canViewReports: true,
    canViewOrders: true,
    canViewChats: true,
    canViewFinance: false,
    canManageStaff: false,
    canUseBlacklist: true,
  },
  finance: {
    canViewUsers: true,
    canViewReports: false,
    canViewOrders: true,
    canViewChats: false,
    canViewFinance: true,
    canManageStaff: false,
    canUseBlacklist: false,
  },
  admin: {
    canViewUsers: true,
    canViewReports: true,
    canViewOrders: true,
    canViewChats: true,
    canViewFinance: true,
    canManageStaff: true,
    canUseBlacklist: true,
  },
};

const HELP_CONTENT: Record<HelpTopic, { title: string; lines: string[] }> = {
  health: {
    title: "Справка: состояние системы",
    lines: [
      "Панель показывает агрегированное здоровье модерации: нагрузку команды, просроченные P1/P2 и статус авто-эскалации.",
      "Красная зона — 3+ критичных просроченных или перегруз модератора (20+ активных кейсов). Жёлтая — есть просроченные или нагрузка от 12 кейсов.",
      "Кнопки позволяют быстро эскалировать просроченные жалобы, перейти к P1 или обновить метрики.",
      "Workers: app (API), telegram (нужен TELEGRAM_SESSION — без него только этот процесс падает), social (очередь соцсетей; без OAuth джобы откладываются).",
    ],
  },
  autoEscalation: {
    title: "Справка: авто-эскалация",
    lines: [
      "Авто-эскалация повышает приоритет просроченных жалоб P1/P2 без ручного вмешательства модератора.",
      "Интервал — как часто фоновый процесс проверяет очередь (в минутах).",
      "Кулдаун — минимальный промежуток между повторными эскалациями одной жалобы (в часах).",
    ],
  },
  rbac: {
    title: "Справка: права доступа",
    lines: [
      "RBAC задаёт, какие разделы админки видит каждый сотрудник: пользователи, жалобы, заказы, чаты, финансы.",
      "Пресеты «Поддержка», «Модератор», «Финансы», «Админ» — быстрый старт; права можно уточнить чекбоксами.",
      "Owner может назначать админов и менять права; изменения фиксируются в аудите.",
    ],
  },
  audit: {
    title: "Справка: аудит",
    lines: [
      "Журнал всех значимых действий админов: блокировки, назначения, эскалации, смена настроек.",
      "Фильтры по типу, важности, актору и тексту помогают расследовать инциденты.",
      "Экспорт CSV — выгрузка до 2000 событий для отчётности.",
    ],
  },
  users: {
    title: "Справка: пользователи",
    lines: [
      "Список разбит на категории риска: чистые, подозрительные, нарушители, заблокированные.",
      "Досье показывает риск, жалобы, топ чатов и заказы; ghost-режим открывает чат/заказ от имени пользователя.",
      "Доступны блокировка, чёрный список, разблокировка, назначение админа и скрытие бейджа.",
    ],
  },
  reports: {
    title: "Справка: жалобы",
    lines: [
      "Жалобы с приоритетами P1–P3 и SLA; просроченные P1/P2 попадают в критичный inbox.",
      "Назначайте исполнителя, решайте или отклоняйте; фильтры «Мои» и «Без исполнителя» ускоряют triage.",
      "Эскалация повышает приоритет просроченных кейсов автоматически или вручную.",
    ],
  },
  withdrawals: {
    title: "Справка: выводы средств",
    lines: [
      "Заявки на вывод от мастеров; одобрение переводит статус в «выплачен».",
      "Перед одобрением проверяйте досье пользователя и историю заказов.",
      "Отклонение оставляет комментарий в аудите; повторная заявка возможна после исправления реквизитов.",
    ],
  },
  channels: {
    title: "Справка: управление каналами",
    lines: [
      "Здесь настраиваются все каналы комьюнити: название, порядок в боковой панели, кто может писать и админы канала.",
      "Перетащите строку за ⋮⋮ для изменения порядка — он сразу сохраняется и отражается в разделе «Сообщения → Каналы».",
      "Режим «Только владелец» — канал только для объявлений; «Владелец и админы» — пишут назначенные модераторы канала.",
      "Архив скрывает канал из списка чатов, но не удаляет историю сообщений.",
      "Удаление (🗑) доступно для любого канала — действие необратимо, все сообщения будут потеряны.",
      "Все изменения фиксируются в аудите (типы «Изменение канала» и «Изменение порядка каналов»).",
    ],
  },
};

export default function AdminPage() {
  const { user, loading } = useAuth();
  const { formatSum } = useLocale();
  const router = useRouter();
  const toast = useToast();

  const [perms, setPerms] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [reportQueue, setReportQueue] = useState<any>(null);
  const [reportQueueItems, setReportQueueItems] = useState<any[]>([]);
  const [reportPriorityFilter, setReportPriorityFilter] = useState<"all" | "P1" | "P2" | "P3">("all");
  const [reportOwnerFilter, setReportOwnerFilter] = useState<"all" | "mine" | "unassigned">("all");
  const [reportAssigneeDraft, setReportAssigneeDraft] = useState<Record<string, string>>({});
  const [moderationSettings, setModerationSettings] = useState<any>(null);
  const [auditEvents, setAuditEvents] = useState<any[]>([]);
  const [auditType, setAuditType] = useState("all");
  const [auditSeverity, setAuditSeverity] = useState("all");
  const [auditActor, setAuditActor] = useState("");
  const [auditQuery, setAuditQuery] = useState("");
  const [staffPermissionDraft, setStaffPermissionDraft] = useState<Record<string, Record<string, boolean>>>({});
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [ownerUsername, setOwnerUsername] = useState("owner");
  const [dataLoading, setDataLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [queryDebounced, setQueryDebounced] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [userSectionsOpen, setUserSectionsOpen] = useState<Record<UserSectionKey, boolean>>({
    clean: false,
    suspicious: false,
    violator: false,
    blocked: false,
  });
  const [expandedUsers, setExpandedUsers] = useState<Record<string, boolean>>({});
  const [blockModal, setBlockModal] = useState<{ user: any; mode: "manual" | "blacklist" } | null>(null);
  const [blockReason, setBlockReason] = useState("spam");
  const [blockDetails, setBlockDetails] = useState("");
  const [blockFiles, setBlockFiles] = useState<File[]>([]);
  const [blockDuration, setBlockDuration] = useState("0");
  const [blocking, setBlocking] = useState(false);
  const [expandedTopChats, setExpandedTopChats] = useState<Record<string, boolean>>({});
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  const [activeOrderStatus, setActiveOrderStatus] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [helpTopic, setHelpTopic] = useState<HelpTopic | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [rbacOpen, setRbacOpen] = useState(false);
  const [channelsOpen, setChannelsOpen] = useState(false);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [workerHealth, setWorkerHealth] = useState<{
    workers?: Record<string, string>;
    paymentsLive?: boolean;
    socialOAuthConfigured?: Record<string, boolean>;
  } | null>(null);

  const isAdmin = isAdminUser(user);

  function ensureStaffDraft(st: any[]) {
    const next: Record<string, Record<string, boolean>> = {};
    for (const item of st) {
      if (item.role === "owner") continue;
      next[item.id] = {
        canViewUsers: Boolean(item.permissions?.canViewUsers),
        canViewReports: Boolean(item.permissions?.canViewReports),
        canViewOrders: Boolean(item.permissions?.canViewOrders),
        canViewChats: Boolean(item.permissions?.canViewChats),
        canViewFinance: Boolean(item.permissions?.canViewFinance),
        canManageStaff: Boolean(item.permissions?.canManageStaff),
        canUseBlacklist: Boolean(item.permissions?.canUseBlacklist),
      };
    }
    setStaffPermissionDraft(next);
  }

  function load(search = queryDebounced) {
    setDataLoading(true);
    Promise.allSettled([
      admin.me(),
      admin.reports(),
      admin.withdrawals(),
      admin.users(search),
      admin.staff(),
      admin.moderationSettings().catch(() => null),
      admin.auditEvents({ type: auditType, severity: auditSeverity, actor: auditActor, q: auditQuery, limit: 120 }).catch(() => null),
      health.get().catch(() => null),
    ])
      .then(([m, r, w, u, s, mod, audit, h]) => {
        if (m.status === "fulfilled") setPerms(m.value);
        if (r.status === "fulfilled") {
          setReports(r.value.reports || []);
          setReportQueue(r.value.queue || null);
          setReportQueueItems(r.value.queueItems || []);
        }
        if (w.status === "fulfilled") setWithdrawals(w.value.withdrawals || []);
        if (u.status === "fulfilled") setUsersList(u.value.users || []);
        if (s.status === "fulfilled") {
          const admins = s.value.admins || [];
          setStaff(admins);
          setOwnerUsername(s.value.ownerUsername || admins.find((x: any) => x.role === "owner")?.username || "owner");
          ensureStaffDraft(admins);
        }
        if (mod.status === "fulfilled" && mod.value?.settings) setModerationSettings(mod.value.settings);
        if (audit.status === "fulfilled" && audit.value?.events) setAuditEvents(audit.value.events || []);
        if (h.status === "fulfilled" && h.value) setWorkerHealth(h.value);
        setLastUpdated(new Date());
        setError("");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка загрузки"))
      .finally(() => setDataLoading(false));
  }

  useEffect(() => {
    const t = setTimeout(() => setQueryDebounced(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  async function downloadAuditCsv() {
    try {
      const token = localStorage.getItem("alter_token");
      const url = admin.buildAuditCsvUrl({
        type: auditType,
        severity: auditSeverity,
        actor: auditActor,
        q: auditQuery,
        limit: 2000,
      });
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Не удалось скачать CSV");
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "audit-events.csv";
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Ошибка экспорта", true);
    }
  }

  async function openSummary(item: any) {
    setSelected(item);
    setExpandedTopChats({});
    setExpandedOrders({});
    setActiveOrderStatus(null);
    try {
      const data = await admin.userSummary(item.id);
      setSummary(data);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Не удалось загрузить досье", true);
    }
  }

  async function handleBlockSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!blockModal) return;
    if (blockModal.user.staffRole === "owner" || blockModal.user.ownerProtected) {
      toast("Владельца платформы нельзя заблокировать", true);
      return;
    }
    setBlocking(true);
    try {
      const uploaded: string[] = [];
      for (const file of blockFiles) {
        const up = await uploadFile(file, file.name, file.type);
        uploaded.push(up.url);
      }
      const reasonLabel = BLOCK_REASONS.find((r) => r.id === blockReason)?.label || blockReason;
      await messages.block(blockModal.user.id, {
        reason: reasonLabel,
        details: blockDetails.trim(),
        files: uploaded,
        source: blockModal.mode === "blacklist" ? "blacklist" : "manual",
        durationHours: Number(blockDuration || 0),
      });
      toast(
        blockModal.mode === "blacklist"
          ? "Пользователь добавлен в чёрный список"
          : "Пользователь заблокирован"
      );
      setBlockModal(null);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Не удалось выполнить блокировку", true);
    } finally {
      setBlocking(false);
    }
  }

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!isAdmin) return;
    load(queryDebounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, isAdmin, router, queryDebounced]);

  if (loading || (isAdmin && dataLoading && !perms)) {
    return (
      <StudioShell>
        <SkeletonPage className="pt-6" />
      </StudioShell>
    );
  }

  if (!isAdmin) {
    return (
      <StudioShell>
        <div className="p-6">
          <EmptyState
            title="Нет доступа к админ-панели"
            action={<Button href="/explore">На Explore</Button>}
          />
        </div>
      </StudioShell>
    );
  }

  const groupedUsers = usersList.reduce(
    (acc, u) => {
      const bucket = (u.ownerProtected || u.staffRole === "owner" ? "clean" : u.riskBucket || "clean") as UserSectionKey;
      if (!acc[bucket]) acc.clean.push(u);
      else acc[bucket].push(u);
      return acc;
    },
    { clean: [] as any[], suspicious: [] as any[], violator: [] as any[], blocked: [] as any[] }
  );

  const sectionMeta: { key: UserSectionKey; title: string; tone: string }[] = [
    { key: "clean", title: "Чистые", tone: "border-[#6ee7b7]/40 bg-[#6ee7b7]/5" },
    { key: "suspicious", title: "Подозрительные", tone: "border-amber/40 bg-amber/5" },
    { key: "violator", title: "Нарушители", tone: "border-[#ff5b7f]/40 bg-[#ff5b7f]/5" },
    { key: "blocked", title: "Заблокированные", tone: "border-[#ff426f]/60 bg-[#ff426f]/10" },
  ];

  const visibleQueueItems =
    reportPriorityFilter === "all"
      ? reportQueueItems
      : reportQueueItems.filter((x: any) => x.priority === reportPriorityFilter);

  const criticalInbox = reportQueueItems
    .filter((x: any) => x.overdue && (x.priority === "P1" || x.priority === "P2"))
    .sort((a: any, b: any) => {
      if (a.priority !== b.priority) return a.priority === "P1" ? -1 : 1;
      return b.ageMinutes - a.ageMinutes;
    });

  const staffLoad = (staff || []).map((s: any) => {
    const activeCases = reports.filter(
      (r: any) => (r.status === "pending" || r.status === "in_review") && r.assignee?.id === s.id
    ).length;
    const inReviewCases = reports.filter((r: any) => r.status === "in_review" && r.assignee?.id === s.id).length;
    return { ...s, activeCases, inReviewCases };
  });

  const filteredReports = reports.filter((r: any) => {
    if (reportOwnerFilter === "mine") return r.assignee?.id === user?.id;
    if (reportOwnerFilter === "unassigned") return !r.assignee?.id;
    return true;
  });

  const totalActiveCases = staffLoad.reduce((acc: number, s: any) => acc + Number(s.activeCases || 0), 0);
  const maxLoadModerator = staffLoad
    .slice()
    .sort((a: any, b: any) => Number(b.activeCases || 0) - Number(a.activeCases || 0))[0];
  const avgLoad = staffLoad.length ? totalActiveCases / staffLoad.length : 0;
  const recentCriticalAudits = (auditEvents || [])
    .filter((e: any) => (e.severity || "info") === "high")
    .slice(0, 5);
  const healthTone =
    criticalInbox.length >= 3 || Number(maxLoadModerator?.activeCases || 0) >= 20
      ? "border-[#ff426f]/70 bg-[#ff426f]/10"
      : criticalInbox.length > 0 || Number(maxLoadModerator?.activeCases || 0) >= 12
        ? "border-amber/60 bg-amber/10"
        : "border-[#6ee7b7]/50 bg-[#6ee7b7]/8";

  return (
    <StudioShell>
      <AdminDashboard
        perms={perms}
        lastUpdated={lastUpdated}
        error={error}
        onRefresh={load}
        usersList={usersList}
        staff={staff}
        ownerUsername={ownerUsername}
        totalActiveCases={totalActiveCases}
        criticalInbox={criticalInbox}
        healthTone={healthTone}
        moderationSettings={moderationSettings}
        onModerationSettingsChange={(updater) => setModerationSettings((prev: any) => updater(prev))}
        onModerationSettingsSave={async () => {
          if (!moderationSettings) return;
          try {
            const resp = await admin.patchModerationSettings({
              autoEscalateEnabled: Boolean(moderationSettings.autoEscalateEnabled),
              autoEscalateIntervalMs: Number(moderationSettings.autoEscalateIntervalMs),
              escalationCooldownMs: Number(moderationSettings.escalationCooldownMs),
            });
            setModerationSettings(resp.settings);
            toast("Настройки авто-эскалации сохранены");
            load();
          } catch (e) {
            toast(e instanceof Error ? e.message : "Не удалось сохранить настройки", true);
          }
        }}
        avgLoad={avgLoad}
        maxLoadModerator={maxLoadModerator}
        recentCriticalAudits={recentCriticalAudits}
        rbacOpen={rbacOpen}
        onRbacOpenChange={setRbacOpen}
        channelsOpen={channelsOpen}
        onChannelsOpenChange={setChannelsOpen}
        staffPermissionDraft={staffPermissionDraft}
        onStaffPermissionDraftChange={(userId, key, value) =>
          setStaffPermissionDraft((prev) => ({
            ...prev,
            [userId]: { ...(prev[userId] || {}), [key]: value },
          }))
        }
        onApplyRolePreset={(userId, presetKey) =>
          setStaffPermissionDraft((prev) => ({
            ...prev,
            [userId]: { ...ROLE_PRESETS[presetKey] },
          }))
        }
        onSaveStaffPermissions={async (userId) => {
          const st = staff.find((x) => x.id === userId);
          try {
            await admin.setStaffPermissions(userId, staffPermissionDraft[userId] || {});
            toast(`Права @${st?.username || userId} сохранены`);
            load();
          } catch (e) {
            toast(e instanceof Error ? e.message : "Не удалось сохранить права", true);
          }
        }}
        auditType={auditType}
        auditSeverity={auditSeverity}
        auditActor={auditActor}
        auditQuery={auditQuery}
        auditEvents={auditEvents}
        onAuditTypeChange={setAuditType}
        onAuditSeverityChange={setAuditSeverity}
        onAuditActorChange={setAuditActor}
        onAuditQueryChange={setAuditQuery}
        onDownloadAuditCsv={downloadAuditCsv}
        onHelpTopic={setHelpTopic}
        onQuickActionScroll={(message) => {
          setShowAllUsers(true);
          document.getElementById("admin-users")?.scrollIntoView({ behavior: "smooth" });
          toast(message);
        }}
        query={query}
        onQueryChange={setQuery}
        showAllUsers={showAllUsers}
        onShowAllUsersChange={setShowAllUsers}
        groupedUsers={groupedUsers}
        sectionMeta={sectionMeta}
        userSectionsOpen={userSectionsOpen}
        onUserSectionsOpenChange={(key, open) => setUserSectionsOpen((prev) => ({ ...prev, [key]: open }))}
        expandedUsers={expandedUsers}
        onExpandedUsersChange={(userId, open) => setExpandedUsers((prev) => ({ ...prev, [userId]: open }))}
        onOpenUserDossier={openSummary}
        onToggleStaffRole={async (u) => {
          try {
            await admin.setStaffRole(u.id, u.staffRole !== "admin");
            toast(u.staffRole === "admin" ? "Права админа сняты" : "Назначен админ");
            load();
          } catch (e) {
            toast(e instanceof Error ? e.message : "Ошибка", true);
          }
        }}
        onOpenBlockModal={(u) => {
          setBlockModal({ user: u, mode: "manual" });
          setBlockReason("abuse");
          setBlockDetails("");
          setBlockFiles([]);
          setBlockDuration("24");
        }}
        onOpenBlacklistModal={(u) => {
          setBlockModal({ user: u, mode: "blacklist" });
          setBlockReason("abuse");
          setBlockDetails("");
          setBlockFiles([]);
          setBlockDuration("0");
        }}
        onUnblockUser={async (u) => {
          try {
            await admin.unblockUser(u.id);
            toast(`@${u.username} разблокирован`);
            load();
          } catch (e) {
            toast(e instanceof Error ? e.message : "Ошибка", true);
          }
        }}
        onToggleBadgeHidden={async (u) => {
          try {
            const nextHidden = !u.badgeHidden;
            await admin.setBadgeHidden(u.id, nextHidden);
            toast(nextHidden ? "Бейдж скрыт" : "Бейдж показан");
            load();
          } catch (e) {
            toast(e instanceof Error ? e.message : "Ошибка", true);
          }
        }}
        reportQueue={reportQueue}
        reportPriorityFilter={reportPriorityFilter}
        reportOwnerFilter={reportOwnerFilter}
        visibleQueueItems={visibleQueueItems}
        onReportPriorityFilterChange={setReportPriorityFilter}
        onReportOwnerFilterChange={setReportOwnerFilter}
        onEscalateOverdue={async () => {
          try {
            const r = await admin.escalateOverdueReports();
            toast(`Эскалировано кейсов: ${r.escalated}`);
            load();
          } catch (e) {
            toast(e instanceof Error ? e.message : "Не удалось эскалировать", true);
          }
        }}
        onScrollToP1={() => {
          setReportPriorityFilter("P1");
          setReportOwnerFilter("all");
          document.getElementById("admin-reports")?.scrollIntoView({ behavior: "smooth" });
        }}
        filteredReports={filteredReports}
        staffLoad={staffLoad}
        reportAssigneeDraft={reportAssigneeDraft}
        onReportAssigneeDraftChange={(reportId, assigneeId) =>
          setReportAssigneeDraft((prev) => ({ ...prev, [reportId]: assigneeId }))
        }
        onAssignReport={async (reportId, currentAssigneeId) => {
          const nextAssignee = reportAssigneeDraft[reportId] ?? currentAssigneeId ?? "";
          try {
            if (!nextAssignee) await admin.unassignReport(reportId);
            else await admin.assignReport(reportId, nextAssignee);
            load();
          } catch (e) {
            toast(e instanceof Error ? e.message : "Ошибка назначения", true);
          }
        }}
        onResolveReport={async (reportId) => {
          try {
            await admin.patchReport(reportId, "resolved");
            load();
          } catch (e) {
            toast(e instanceof Error ? e.message : "Ошибка", true);
          }
        }}
        onRejectReport={async (reportId) => {
          try {
            await admin.patchReport(reportId, "rejected");
            load();
          } catch (e) {
            toast(e instanceof Error ? e.message : "Ошибка", true);
          }
        }}
        onApproveWithdrawal={async (id) => {
          try {
            await admin.patchWithdrawal(id, "paid");
            load();
          } catch (e) {
            toast(e instanceof Error ? e.message : "Ошибка", true);
          }
        }}
        onRejectWithdrawal={async (id) => {
          try {
            await admin.patchWithdrawal(id, "rejected");
            load();
          } catch (e) {
            toast(e instanceof Error ? e.message : "Ошибка", true);
          }
        }}
        withdrawals={withdrawals}
        formatSum={formatSum}
      />

      {selected && summary && (
        <UserDossierModal
          summary={summary}
          expandedTopChats={expandedTopChats}
          expandedOrders={expandedOrders}
          activeOrderStatus={activeOrderStatus}
          onClose={() => {
            setSelected(null);
            setSummary(null);
          }}
          onToggleTopChat={(conversationId) =>
            setExpandedTopChats((prev) => ({ ...prev, [conversationId]: !prev[conversationId] }))
          }
          onToggleOrder={(orderId) =>
            setExpandedOrders((prev) => ({ ...prev, [orderId]: !prev[orderId] }))
          }
          onOrderStatusChange={(status) => {
            setExpandedOrders({});
            setActiveOrderStatus(status);
          }}
        />
      )}

      <BlockUserModal
        blockModal={blockModal}
        blockReason={blockReason}
        blockDetails={blockDetails}
        blockFiles={blockFiles}
        blockDuration={blockDuration}
        blocking={blocking}
        onClose={() => setBlockModal(null)}
        onReasonChange={setBlockReason}
        onDetailsChange={setBlockDetails}
        onDurationChange={setBlockDuration}
        onFilesChange={setBlockFiles}
        onSubmit={handleBlockSubmit}
      />

      {helpTopic && (
        <Modal title={HELP_CONTENT[helpTopic].title} onClose={() => setHelpTopic(null)}>
          <div className="space-y-2">
            {HELP_CONTENT[helpTopic].lines.map((line, i) => (
              <p key={`${helpTopic}-${i}`} className="text-[13px] text-ink-45 leading-relaxed">
                • {line}
              </p>
            ))}
          </div>
        </Modal>
      )}

      {(perms?.isOwner || perms?.permissions?.canViewUsers || perms?.canViewUsers) && (
        <div className="px-4 pb-8 max-w-[1100px] mx-auto w-full">
          <AdminRoleChangePanel />
          {Boolean(perms?.isOwner) && workerHealth?.workers && (
            <div className="border border-line p-4 mb-4 bg-stage">
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-45 mb-2">
                Workers · health
              </div>
              <ul className="text-[12px] text-ink-70 space-y-1.5">
                {Object.entries(workerHealth.workers).map(([k, v]) => (
                  <li key={k}>
                    <span className="text-paper font-mono text-[11px]">{k}</span> — {v}
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-ink-45 mt-2">
                Платежи: {workerHealth.paymentsLive ? "LIVE" : "выкл (PAYMENTS_LIVE)"}
                {workerHealth.socialOAuthConfigured
                  ? ` · OAuth env: YT ${workerHealth.socialOAuthConfigured.youtube ? "ok" : "—"}, Meta ${
                      workerHealth.socialOAuthConfigured.meta ? "ok" : "—"
                    }, TikTok ${workerHealth.socialOAuthConfigured.tiktok ? "ok" : "—"}, Gemini ${
                      workerHealth.socialOAuthConfigured.gemini ? "ok" : "—"
                    }`
                  : null}
              </p>
            </div>
          )}
          {Boolean(perms?.isOwner) && (
            <Suspense fallback={<SkeletonPage className="pt-4" />}>
              <AdminSocialPanel />
            </Suspense>
          )}
        </div>
      )}
    </StudioShell>
  );
}
