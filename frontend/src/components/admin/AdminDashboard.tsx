"use client";

import dynamic from "next/dynamic";
import { UserMinus, UserPlus, UserX, UserCheck, KeyRound, Hash } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { AuditEventCard } from "@/lib/auditFormat";
import {
  AdminBadge,
  AdminFilterChip,
  AdminFooterStatus,
  AdminPageHeader,
  AdminPanel,
  AdminPrimaryButton,
  AdminQuickAction,
  AdminSectionTitle,
  AdminStatCard,
  AdminUserRow,
  Clock,
  FolderOpen,
  Shield,
  Users,
  Zap,
} from "@/components/admin/AdminUi";

export type HelpTopic =
  | "health"
  | "autoEscalation"
  | "rbac"
  | "audit"
  | "users"
  | "reports"
  | "withdrawals"
  | "channels";

export type UserSectionKey = "clean" | "suspicious" | "violator" | "blocked";

const AdminChannelManagement = dynamic(
  () => import("@/components/admin/AdminChannelManagement").then((m) => m.AdminChannelManagement),
  { ssr: false }
);
const AdminPartnersPanel = dynamic(
  () => import("@/components/admin/AdminPartnersPanel").then((m) => m.AdminPartnersPanel),
  { ssr: false }
);

const PERMISSION_KEYS = [
  "canViewUsers",
  "canViewReports",
  "canViewOrders",
  "canViewChats",
  "canViewFinance",
  "canManageStaff",
  "canUseBlacklist",
] as const;

const PERMISSION_LABELS: Record<string, string> = {
  canViewUsers: "Пользователи",
  canViewReports: "Жалобы",
  canViewOrders: "Заказы",
  canViewChats: "Чаты",
  canViewFinance: "Финансы",
  canManageStaff: "Персонал",
  canUseBlacklist: "Чёрный список",
};

const ROLE_PRESET_LABELS: Record<string, string> = {
  support: "Поддержка",
  moderator: "Модератор",
  finance: "Финансы",
  admin: "Админ",
};

export function AdminDashboard({
  perms,
  lastUpdated,
  error,
  onRefresh,
  usersList,
  staff,
  ownerUsername = "owner",
  totalActiveCases,
  criticalInbox,
  healthTone,
  moderationSettings,
  onModerationSettingsChange,
  onModerationSettingsSave,
  avgLoad,
  maxLoadModerator,
  recentCriticalAudits,
  rbacOpen,
  onRbacOpenChange,
  channelsOpen,
  onChannelsOpenChange,
  staffPermissionDraft,
  onStaffPermissionDraftChange,
  onApplyRolePreset,
  onSaveStaffPermissions,
  auditType,
  auditSeverity,
  auditActor,
  auditQuery,
  auditEvents,
  onAuditTypeChange,
  onAuditSeverityChange,
  onAuditActorChange,
  onAuditQueryChange,
  onDownloadAuditCsv,
  onHelpTopic,
  onQuickActionScroll,
  query,
  onQueryChange,
  showAllUsers,
  onShowAllUsersChange,
  groupedUsers,
  sectionMeta,
  userSectionsOpen,
  onUserSectionsOpenChange,
  expandedUsers,
  onExpandedUsersChange,
  onOpenUserDossier,
  onToggleStaffRole,
  onOpenBlockModal,
  onOpenBlacklistModal,
  onUnblockUser,
  onToggleBadgeHidden,
  reportQueue,
  reportPriorityFilter,
  reportOwnerFilter,
  visibleQueueItems,
  onReportPriorityFilterChange,
  onReportOwnerFilterChange,
  onEscalateOverdue,
  onScrollToP1,
  filteredReports,
  staffLoad,
  reportAssigneeDraft,
  onReportAssigneeDraftChange,
  onAssignReport,
  onResolveReport,
  onRejectReport,
  onApproveWithdrawal,
  onRejectWithdrawal,
  withdrawals,
  formatSum,
}: {
  perms: any;
  lastUpdated: Date | null;
  error: string;
  onRefresh: () => void;
  usersList: any[];
  staff: any[];
  ownerUsername?: string;
  totalActiveCases: number;
  criticalInbox: any[];
  healthTone: string;
  moderationSettings: any;
  onModerationSettingsChange: (updater: (prev: any) => any) => void;
  onModerationSettingsSave: () => void;
  avgLoad: number;
  maxLoadModerator: any;
  recentCriticalAudits: any[];
  rbacOpen: boolean;
  onRbacOpenChange: (open: boolean) => void;
  channelsOpen: boolean;
  onChannelsOpenChange: (open: boolean) => void;
  staffPermissionDraft: Record<string, Record<string, boolean>>;
  onStaffPermissionDraftChange: (userId: string, key: string, value: boolean) => void;
  onApplyRolePreset: (userId: string, preset: "support" | "moderator" | "finance" | "admin") => void;
  onSaveStaffPermissions: (userId: string) => void;
  auditType: string;
  auditSeverity: string;
  auditActor: string;
  auditQuery: string;
  auditEvents: any[];
  onAuditTypeChange: (value: string) => void;
  onAuditSeverityChange: (value: string) => void;
  onAuditActorChange: (value: string) => void;
  onAuditQueryChange: (value: string) => void;
  onDownloadAuditCsv: () => void;
  onHelpTopic: (topic: HelpTopic) => void;
  onQuickActionScroll: (message: string) => void;
  query: string;
  onQueryChange: (value: string) => void;
  showAllUsers: boolean;
  onShowAllUsersChange: (value: boolean) => void;
  groupedUsers: Record<UserSectionKey, any[]>;
  sectionMeta: { key: UserSectionKey; title: string; tone: string }[];
  userSectionsOpen: Record<UserSectionKey, boolean>;
  onUserSectionsOpenChange: (key: UserSectionKey, open: boolean) => void;
  expandedUsers: Record<string, boolean>;
  onExpandedUsersChange: (userId: string, open: boolean) => void;
  onOpenUserDossier: (user: any) => void;
  onToggleStaffRole: (user: any) => void;
  onOpenBlockModal: (user: any) => void;
  onOpenBlacklistModal: (user: any) => void;
  onUnblockUser: (user: any) => void;
  onToggleBadgeHidden: (user: any) => void;
  reportQueue: any;
  reportPriorityFilter: "all" | "P1" | "P2" | "P3";
  reportOwnerFilter: "all" | "mine" | "unassigned";
  visibleQueueItems: any[];
  onReportPriorityFilterChange: (value: "all" | "P1" | "P2" | "P3") => void;
  onReportOwnerFilterChange: (value: "all" | "mine" | "unassigned") => void;
  onEscalateOverdue: () => void;
  onScrollToP1: () => void;
  filteredReports: any[];
  staffLoad: any[];
  reportAssigneeDraft: Record<string, string>;
  onReportAssigneeDraftChange: (reportId: string, assigneeId: string) => void;
  onAssignReport: (reportId: string, currentAssigneeId?: string) => void;
  onResolveReport: (reportId: string) => void;
  onRejectReport: (reportId: string) => void;
  onApproveWithdrawal: (id: string) => void;
  onRejectWithdrawal: (id: string) => void;
  withdrawals: any[];
  formatSum: (amount: number) => string;
}) {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1280px]">
      <AdminPageHeader isOwner={Boolean(perms?.isOwner)} updatedAt={lastUpdated} onRefresh={onRefresh} />

      {error && (
        <p className="text-amber text-[13px] mb-4">
          {error}{" "}
          <Button size="sm" onClick={onRefresh}>
            Повторить
          </Button>
        </p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <AdminStatCard
          tone="purple"
          label="Пользователи"
          value={usersList.length}
          hint="Всего в базе"
          icon={<Users size={18} />}
        />
        <AdminStatCard
          tone="green"
          label="Персонал"
          value={staff.length}
          hint="Команда модерации"
          icon={<Shield size={18} />}
        />
        <AdminStatCard
          tone="amber"
          label="Активные кейсы"
          value={totalActiveCases}
          hint="Жалобы в работе"
          icon={<FolderOpen size={18} />}
        />
        <AdminStatCard
          tone="red"
          label="Критичные просроченные"
          value={criticalInbox.length}
          hint="P1/P2 с нарушением SLA"
          icon={<Clock size={18} />}
        />
      </div>

      <AdminPanel className={cn("p-4 mb-4 sticky top-2 z-20 backdrop-blur-md border", healthTone)}>
        <AdminSectionTitle
          title="Состояние системы"
          helpOnClick={() => onHelpTopic("health")}
          helpLabel="Справка: состояние системы"
          right={
            <span className="inline-flex items-center gap-1.5 text-[11px] text-[#6ee7b7]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#10b981] animate-pulse" />
              Авто-мониторинг активен
            </span>
          }
        />
        <div className="flex flex-wrap gap-2 text-[12px] mb-3">
          <AdminBadge tone={moderationSettings?.autoEscalateEnabled ? "green" : "amber"}>
            Авто-эскалация {moderationSettings?.autoEscalateEnabled ? "ВКЛ" : "ВЫКЛ"}
          </AdminBadge>
          <AdminBadge tone="green">
            Интервал{" "}
            {Math.max(1, Math.round((moderationSettings?.autoEscalateIntervalMs || 60000) / 60000))} мин
          </AdminBadge>
          <AdminBadge tone="purple">
            Кулдаун эскалации{" "}
            {Math.max(1, Math.round((moderationSettings?.escalationCooldownMs || 3600000) / 3600000))} ч
          </AdminBadge>
          <AdminBadge tone={criticalInbox.length > 0 ? "red" : "green"}>
            Критичные просроченные {criticalInbox.length}
          </AdminBadge>
          <AdminBadge tone="purple">Активные кейсы {totalActiveCases}</AdminBadge>
        </div>
        <div className="flex flex-wrap gap-2 text-[12px] mb-4">
          <AdminBadge tone="neutral">Средняя нагрузка {avgLoad.toFixed(1)}</AdminBadge>
          <AdminBadge tone={Number(maxLoadModerator?.activeCases || 0) >= 15 ? "amber" : "neutral"}>
            Макс. нагрузка{" "}
            {maxLoadModerator
              ? `@${maxLoadModerator.username} (${maxLoadModerator.activeCases})`
              : "нет данных"}
          </AdminBadge>
        </div>
        <div className="flex flex-wrap gap-2">
          <AdminPrimaryButton variant="purple" onClick={onEscalateOverdue}>
            <Zap size={14} /> Эскалировать просроченные
          </AdminPrimaryButton>
          <AdminPrimaryButton variant="outline" onClick={onScrollToP1}>
            Перейти к P1
          </AdminPrimaryButton>
          <AdminPrimaryButton variant="outline" onClick={onRefresh}>
            Обновить состояние
          </AdminPrimaryButton>
        </div>
      </AdminPanel>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <AdminPanel className="p-4">
          <AdminSectionTitle title="Последние критичные события аудита" />
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {recentCriticalAudits.length === 0 ? (
              <p className="text-ink-45 text-[13px]">Нет критичных событий за последнее время</p>
            ) : (
              recentCriticalAudits.map((e: any) => <AuditEventCard key={`health-audit-${e.id}`} event={e} />)
            )}
          </div>
        </AdminPanel>

        <div className="space-y-4">
          {moderationSettings && (
            <AdminPanel className="p-4">
              <AdminSectionTitle
                title="Авто-эскалация (настройки)"
                helpOnClick={() => onHelpTopic("autoEscalation")}
                helpLabel="Справка: авто-эскалация"
              />
              <div className="space-y-3">
                <label className="text-[13px] text-ink-45 flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-[#7c3aed]"
                    checked={Boolean(moderationSettings.autoEscalateEnabled)}
                    onChange={(e) =>
                      onModerationSettingsChange((prev) => ({ ...prev, autoEscalateEnabled: e.target.checked }))
                    }
                  />
                  Автоматически эскалировать
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-[12px] text-ink-45 block">
                    Интервал (минуты)
                    <input
                      className="field-box h-10 w-full mt-1"
                      type="number"
                      min={1}
                      value={Math.max(1, Math.round((moderationSettings.autoEscalateIntervalMs || 60000) / 60000))}
                      onChange={(e) =>
                        onModerationSettingsChange((prev) => ({
                          ...prev,
                          autoEscalateIntervalMs: Math.max(60000, Number(e.target.value || 1) * 60000),
                        }))
                      }
                    />
                  </label>
                  <label className="text-[12px] text-ink-45 block">
                    Кулдаун эскалации (часы)
                    <input
                      className="field-box h-10 w-full mt-1"
                      type="number"
                      min={1}
                      value={Math.max(
                        1,
                        Math.round((moderationSettings.escalationCooldownMs || 3600000) / 3600000)
                      )}
                      onChange={(e) =>
                        onModerationSettingsChange((prev) => ({
                          ...prev,
                          escalationCooldownMs: Math.max(3600000, Number(e.target.value || 1) * 3600000),
                        }))
                      }
                    />
                  </label>
                </div>
                <AdminPrimaryButton className="w-full" variant="purple" onClick={onModerationSettingsSave}>
                  Сохранить
                </AdminPrimaryButton>
              </div>
            </AdminPanel>
          )}

          <AdminPanel className="p-4">
            <AdminSectionTitle
              title="Права доступа (RBAC)"
              helpOnClick={() => onHelpTopic("rbac")}
              helpLabel="Справка: права доступа"
            />
            {staff.filter((x: any) => x.role !== "owner").length === 0 ? (
              <p className="text-ink-45 text-[13px]">
                Нет сотрудников для настройки прав — назначьте админов в разделе пользователей
              </p>
            ) : !rbacOpen ? (
              <AdminPrimaryButton variant="outline" className="w-full" onClick={() => onRbacOpenChange(true)}>
                <KeyRound size={14} /> Развернуть настройки RBAC
              </AdminPrimaryButton>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {staff
                  .filter((x: any) => x.role !== "owner")
                  .map((st: any) => (
                    <div
                      key={`rbac-${st.id}`}
                      className="border border-[#2f2b45] rounded-[8px] bg-[#12101a]/50 px-3 py-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <p className="font-semibold text-[13px]">@{st.username}</p>
                        <div className="flex flex-wrap gap-1">
                          {(["support", "moderator", "finance", "admin"] as const).map((preset) => (
                            <AdminFilterChip
                              key={preset}
                              onClick={() => onApplyRolePreset(st.id, preset)}
                            >
                              {ROLE_PRESET_LABELS[preset]}
                            </AdminFilterChip>
                          ))}
                        </div>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-1.5 mb-2">
                        {PERMISSION_KEYS.map((key) => (
                          <label
                            key={`${st.id}-${key}`}
                            className="text-[11px] text-ink-45 flex items-center gap-2 border border-[#2f2b45] rounded-[6px] px-2 py-1.5"
                          >
                            <input
                              type="checkbox"
                              className="accent-[#7c3aed]"
                              checked={Boolean(staffPermissionDraft[st.id]?.[key])}
                              onChange={(e) => onStaffPermissionDraftChange(st.id, key, e.target.checked)}
                            />
                            {PERMISSION_LABELS[key]}
                          </label>
                        ))}
                      </div>
                      <AdminPrimaryButton variant="purple" onClick={() => onSaveStaffPermissions(st.id)}>
                        Сохранить права
                      </AdminPrimaryButton>
                    </div>
                  ))}
              </div>
            )}
          </AdminPanel>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <AdminPanel className="p-4">
          <AdminSectionTitle
            title="Центр аудита"
            helpOnClick={() => onHelpTopic("audit")}
            helpLabel="Справка: аудит"
          />
          <div className="grid sm:grid-cols-2 gap-2 mb-3">
            <select
              className="field-box h-10 text-[12px]"
              value={auditType}
              onChange={(e) => onAuditTypeChange(e.target.value)}
            >
              <option value="all">Все типы</option>
              <option value="admin_granted">Назначен админ</option>
              <option value="admin_revoked">Сняты права админа</option>
              <option value="user_blocked">Блокировка пользователя</option>
              <option value="user_unblocked">Разблокировка пользователя</option>
              <option value="report_escalated_overdue">Эскалация просроченной жалобы</option>
              <option value="report_assigned">Назначение жалобы</option>
              <option value="report_status_changed">Изменение статуса жалобы</option>
              <option value="moderation_settings_updated">Изменение настроек модерации</option>
              <option value="channel_settings_updated">Изменение канала</option>
              <option value="channel_reordered">Изменение порядка каналов</option>
              <option value="channel_deleted">Удаление канала</option>
            </select>
            <select
              className="field-box h-10 text-[12px]"
              value={auditSeverity}
              onChange={(e) => onAuditSeverityChange(e.target.value)}
            >
              <option value="all">Любая важность</option>
              <option value="high">Важно</option>
              <option value="warn">Внимание</option>
              <option value="info">Обычное</option>
            </select>
            <input
              className="field-box h-10 text-[12px]"
              placeholder="Актор (ник)"
              value={auditActor}
              onChange={(e) => onAuditActorChange(e.target.value)}
            />
            <input
              className="field-box h-10 text-[12px]"
              placeholder="Поиск по тексту"
              value={auditQuery}
              onChange={(e) => onAuditQueryChange(e.target.value)}
            />
          </div>
          <div className="flex gap-2 mb-3">
            <AdminPrimaryButton variant="purple" onClick={onRefresh}>
              Обновить
            </AdminPrimaryButton>
            <AdminPrimaryButton variant="outline" onClick={onDownloadAuditCsv}>
              Экспорт CSV
            </AdminPrimaryButton>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {auditEvents.length === 0 ? (
              <p className="text-ink-45 text-[13px]">События не найдены</p>
            ) : (
              auditEvents.map((e: any) => <AuditEventCard key={e.id} event={e} />)
            )}
          </div>
        </AdminPanel>

        <AdminPanel className="p-4">
          <AdminSectionTitle title="Быстрые действия" />
          <div className="space-y-2">
            <AdminQuickAction
              tone="red"
              icon={<UserMinus size={16} />}
              label="Снять права админа"
              onClick={() => onQuickActionScroll("Перейдите к пользователям — «Снять права админа»")}
            />
            <AdminQuickAction
              tone="orange"
              icon={<UserPlus size={16} />}
              label="Назначить админа"
              onClick={() => onQuickActionScroll("Перейдите к пользователям — «Назначить админа»")}
            />
            <AdminQuickAction
              tone="pink"
              icon={<UserX size={16} />}
              label="Заблокировать пользователя"
              onClick={() => onQuickActionScroll("Перейдите к пользователям — «Заблокировать»")}
            />
            <AdminQuickAction
              tone="green"
              icon={<UserCheck size={16} />}
              label="Разблокировать пользователя"
              onClick={() => onQuickActionScroll("Перейдите к разделу заблокированных — «Разблокировать»")}
            />
            {Boolean(perms?.isOwner) && (
              <AdminQuickAction
                tone="purple"
                icon={<Hash size={16} />}
                label="Управление каналами"
                onClick={() => {
                  onChannelsOpenChange(true);
                  document.getElementById("admin-channels")?.scrollIntoView({ behavior: "smooth" });
                }}
              />
            )}
          </div>
        </AdminPanel>
      </div>

      {Boolean(perms?.isOwner) && channelsOpen && (
        <AdminChannelManagement
          staffUsernames={staff.map((s: any) => s.username).filter(Boolean)}
          ownerUsername={ownerUsername}
          onHelp={() => onHelpTopic("channels")}
          open={channelsOpen}
          onOpenChange={onChannelsOpenChange}
        />
      )}

      {Boolean(perms?.isOwner) && <AdminPartnersPanel />}

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <AdminPanel className="p-4" id="admin-users">
          <AdminSectionTitle
            title="Пользователи"
            helpOnClick={() => onHelpTopic("users")}
            helpLabel="Справка: пользователи"
          />
          <div className="flex gap-2 mb-3 flex-col sm:flex-row">
            <input
              className="field-box text-[12px] h-10 flex-1 min-w-0"
              placeholder="Поиск: ник / ID / email / телефон"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
            />
            <AdminPrimaryButton variant="purple" onClick={onRefresh} className="sm:shrink-0">
              Найти
            </AdminPrimaryButton>
          </div>
          {!showAllUsers ? (
            <div className="max-h-[320px] overflow-y-auto pr-1 divide-y divide-[#2f2b45]">
              {usersList.map((u: any) => (
                <AdminUserRow
                  key={u.id}
                  username={u.username}
                  displayName={u.displayName}
                  email={u.email || u.phone}
                  role={u.staffRole}
                  onOpen={() => onOpenUserDossier(u)}
                />
              ))}
              {usersList.length === 0 && (
                <p className="text-ink-45 text-[13px] py-2">Пользователи не найдены</p>
              )}
            </div>
          ) : (
            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              {sectionMeta.map((section) => (
                <div key={section.key} className={`rounded-[8px] border overflow-hidden ${section.tone}`}>
                  <button
                    type="button"
                    className="w-full bg-transparent border-0 px-3 py-2 flex items-center justify-between text-left cursor-pointer"
                    onClick={() => onUserSectionsOpenChange(section.key, !userSectionsOpen[section.key])}
                  >
                    <span className="font-semibold text-[14px]">{section.title}</span>
                    <span className="inline-flex items-center gap-2 text-[11px] text-ink-45">
                      <AdminBadge tone="neutral">{groupedUsers[section.key].length}</AdminBadge>
                      {userSectionsOpen[section.key] ? "Свернуть" : "Развернуть"}
                    </span>
                  </button>
                  {userSectionsOpen[section.key] && (
                    <div className="px-2 pb-2 space-y-1">
                      {groupedUsers[section.key].length === 0 ? (
                        <p className="text-[11px] text-ink-45 px-1 py-1">Нет пользователей</p>
                      ) : (
                        groupedUsers[section.key].map((u: any) => (
                          <div
                            key={u.id}
                            className="border border-[#2f2b45] rounded-[6px] bg-[#12101a]/40 px-2 py-2"
                          >
                            <button
                              type="button"
                              className="w-full bg-transparent border-0 p-0 text-left cursor-pointer"
                              onClick={() => onExpandedUsersChange(u.id, !expandedUsers[u.id])}
                            >
                              <p className="font-semibold text-[13px] truncate">@{u.username}</p>
                              <p className="text-[11px] text-ink-45 truncate">
                                {u.email || u.phone || "контакт не указан"}
                              </p>
                            </button>
                            {expandedUsers[u.id] && (
                              <div className="mt-2 pt-2 border-t border-[#2f2b45] flex flex-wrap gap-1.5">
                                <Button size="sm" className="h-8 px-3" onClick={() => onOpenUserDossier(u)}>
                                  Досье
                                </Button>
                                {u.staffRole === "owner" && (
                                  <span className="text-[11px] text-[#6ee7b7] self-center px-1">
                                    Владелец · защищён от блокировок
                                  </span>
                                )}
                                {perms?.isOwner && u.staffRole !== "owner" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 px-3"
                                    onClick={() => onToggleStaffRole(u)}
                                  >
                                    {u.staffRole === "admin" ? "Снять права админа" : "Назначить админа"}
                                  </Button>
                                )}
                                {u.staffRole === "admin" && perms?.isOwner && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 px-3"
                                    onClick={() => onToggleBadgeHidden(u)}
                                  >
                                    {u.badgeHidden ? "Показать бейдж" : "Скрыть бейдж"}
                                  </Button>
                                )}
                                {u.staffRole !== "owner" && !u.ownerProtected && (
                                  <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-3"
                                  onClick={() => onOpenBlockModal(u)}
                                >
                                  Заблокировать
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-3"
                                  onClick={() => onOpenBlacklistModal(u)}
                                >
                                  Чёрный список
                                </Button>
                                  </>
                                )}
                                {u.blockedActive && u.staffRole !== "owner" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 px-3"
                                    onClick={() => onUnblockUser(u)}
                                  >
                                    Разблокировать
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            className="mt-3 text-[12px] text-[#c4b5fd] hover:text-paper bg-transparent border-0 cursor-pointer"
            onClick={() => onShowAllUsersChange(!showAllUsers)}
          >
            {showAllUsers ? "Свернуть список" : "Развернуть по категориям →"}
          </button>
        </AdminPanel>

        <AdminPanel className="p-4">
          <AdminSectionTitle
            title="SLA очередь"
            helpOnClick={() => onHelpTopic("reports")}
            helpLabel="Справка: жалобы и SLA"
          />
          {reportQueue && (
            <>
              <div className="flex flex-wrap gap-2 mb-3">
                <AdminBadge tone="neutral">Pending {reportQueue.pending}</AdminBadge>
                <AdminBadge tone="red">P1 {reportQueue.p1}</AdminBadge>
                <AdminBadge tone="amber">P2 {reportQueue.p2}</AdminBadge>
                <AdminBadge tone="neutral">P3 {reportQueue.p3}</AdminBadge>
                <AdminBadge tone="red">Просрочено {reportQueue.overdue}</AdminBadge>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(["all", "P1", "P2", "P3"] as const).map((p) => (
                  <AdminFilterChip
                    key={p}
                    active={reportPriorityFilter === p}
                    danger={p === "P1"}
                    onClick={() => onReportPriorityFilterChange(p)}
                  >
                    {p === "all" ? "Все" : p}
                  </AdminFilterChip>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(["all", "mine", "unassigned"] as const).map((f) => (
                  <AdminFilterChip
                    key={f}
                    active={reportOwnerFilter === f}
                    onClick={() => onReportOwnerFilterChange(f)}
                  >
                    {f === "all" ? "Все" : f === "mine" ? "Мои" : "Без исполнителя"}
                  </AdminFilterChip>
                ))}
              </div>
              <AdminPrimaryButton variant="danger" className="w-full mb-3" onClick={onEscalateOverdue}>
                Эскалировать просроченные
              </AdminPrimaryButton>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {visibleQueueItems.slice(0, 8).map((r: any) => (
                  <div
                    key={`q-${r.id}`}
                    className="border border-[#2f2b45] rounded-[8px] bg-[#12101a]/40 px-3 py-2 text-[12px]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <AdminBadge
                        tone={r.priority === "P1" ? "red" : r.priority === "P2" ? "amber" : "neutral"}
                      >
                        {r.priority}
                      </AdminBadge>
                      <span className="text-ink-45">
                        {r.ageMinutes} мин · SLA {r.slaMinutes} мин
                      </span>
                    </div>
                    <p className="mt-1 text-paper">{r.reason}</p>
                    <p className="text-ink-45 mt-1">
                      {r.assignee ? `@${r.assignee.username}` : "Без исполнителя"}
                      {r.overdue ? " · просрочено" : ""}
                    </p>
                  </div>
                ))}
                {visibleQueueItems.length === 0 && (
                  <p className="text-ink-45 text-[13px]">Жалобы в очереди отсутствуют</p>
                )}
              </div>
            </>
          )}
        </AdminPanel>
      </div>

      {criticalInbox.length > 0 && (
        <AdminPanel className="p-4 mb-4 border-[#ef4444]/40">
          <AdminSectionTitle title="Критичный inbox · просроченные P1/P2" />
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {criticalInbox.slice(0, 12).map((r: any) => (
              <div
                key={`critical-${r.id}`}
                className="border border-[#ef4444]/30 rounded-[8px] bg-[#12101a]/50 px-3 py-2 text-[12px]"
              >
                <div className="flex items-center justify-between gap-2">
                  <AdminBadge tone={r.priority === "P1" ? "red" : "amber"}>{r.priority}</AdminBadge>
                  <span className="text-ink-45">
                    {r.ageMinutes} мин / SLA {r.slaMinutes} мин
                  </span>
                </div>
                <p className="mt-1">{r.reason}</p>
              </div>
            ))}
          </div>
        </AdminPanel>
      )}

      <div className="grid lg:grid-cols-2 gap-4 mb-4" id="admin-reports">
        <AdminPanel className="p-4">
          <AdminSectionTitle
            title="Жалобы"
            helpOnClick={() => onHelpTopic("reports")}
            helpLabel="Справка: жалобы"
          />
          {staffLoad.length > 0 && (
            <div className="mb-3 grid sm:grid-cols-2 gap-2">
              {staffLoad.map((s: any) => (
                <div
                  key={`staff-load-${s.id}`}
                  className="border border-[#2f2b45] rounded-[8px] bg-[#12101a]/40 px-3 py-2 text-[12px]"
                >
                  <p className="font-semibold">@{s.username}</p>
                  <p className="text-ink-45 mt-0.5">
                    В работе: {s.inReviewCases} · Активных: {s.activeCases}
                  </p>
                </div>
              ))}
            </div>
          )}
          {filteredReports.length === 0 ? (
            <p className="text-ink-45 text-[13px]">Жалоб нет</p>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {filteredReports.map((r) => (
                <div
                  key={r.id}
                  className="border border-[#2f2b45] rounded-[8px] bg-[#12101a]/40 px-3 py-2.5 text-[12px]"
                >
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {r.overdue && (r.priority === "P1" || r.priority === "P2") && (
                      <AdminBadge tone="red">
                        Просрочено {r.priority}
                      </AdminBadge>
                    )}
                    <span className="text-ink-45">
                      {r.reporter?.username ? `@${r.reporter.username}` : "—"}
                    </span>
                    <span className="text-ink-45">
                      {r.assignee ? `→ @${r.assignee.username}` : "→ не назначена"}
                    </span>
                  </div>
                  <p className="text-paper">
                    {r.reason}
                    {r.details ? ` · ${r.details}` : ""}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <select
                      className="field-box h-8 text-[11px] min-w-[140px] flex-1"
                      value={reportAssigneeDraft[r.id] ?? r.assignee?.id ?? ""}
                      onChange={(e) => onReportAssigneeDraftChange(r.id, e.target.value)}
                    >
                      <option value="">Выберите исполнителя</option>
                      {staffLoad.map((s: any) => (
                        <option key={`assignee-opt-${r.id}-${s.id}`} value={s.id}>
                          @{s.username}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onAssignReport(r.id, r.assignee?.id)}
                    >
                      Назначить
                    </Button>
                    {(r.status === "pending" || r.status === "in_review") && (
                      <>
                        <Button size="sm" onClick={() => onResolveReport(r.id)}>
                          Решить
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => onRejectReport(r.id)}>
                          Отклонить
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </AdminPanel>

        <AdminPanel className="p-4">
          <AdminSectionTitle
            title="Выводы средств"
            helpOnClick={() => onHelpTopic("withdrawals")}
            helpLabel="Справка: выводы"
          />
          {withdrawals.length === 0 ? (
            <p className="text-ink-45 text-[13px]">Заявок нет</p>
          ) : (
            <div className="space-y-2">
              {withdrawals.map((w) => (
                <div
                  key={w.id}
                  className="border border-[#2f2b45] rounded-[8px] bg-[#12101a]/40 px-3 py-2.5 text-[12px]"
                >
                  <p className="font-semibold text-paper">
                    @{w.username} · {formatSum(w.amount)}
                  </p>
                  <p className="text-ink-45 mt-0.5">
                    {w.method} · {w.details}
                  </p>
                  <p className="text-ink-45 mt-1">
                    {w.status === "pending" ? "Ожидает обработки" : w.status}
                  </p>
                  {w.status === "pending" && (
                    <div className="flex gap-1.5 mt-2">
                      <Button size="sm" onClick={() => onApproveWithdrawal(w.id)}>
                        Одобрить
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => onRejectWithdrawal(w.id)}>
                        Отклонить
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </AdminPanel>
      </div>

      <AdminFooterStatus />
    </div>
  );
}
