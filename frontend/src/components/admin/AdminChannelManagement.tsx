"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  ExternalLink,
  GripVertical,
  Lock,
  MessageSquare,
  Pin,
  Plus,
  Settings2,
  Trash2,
  Users,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { messages as messagesApi } from "@/lib/api";
import {
  mergeAdminChannels,
  type AdminChannelRow,
  COMMUNITY_CHANNEL_COUNT,
} from "@/lib/communityChannels";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { AdminBadge, AdminHelpButton, AdminPanel, AdminPrimaryButton } from "@/components/admin/AdminUi";

type WriteMode = "members" | "owner_only" | "channel_admins";

const WRITE_MODE_LABELS: Record<WriteMode, string> = {
  members: "Все участники",
  owner_only: "Только владелец",
  channel_admins: "Владелец и админы канала",
};

const WRITE_MODE_HINTS: Record<WriteMode, string> = {
  members: "Любой участник канала может отправлять сообщения.",
  owner_only: "Писать может только владелец (@nyx.cosplay). Читать могут все.",
  channel_admins: "Писать могут владелец и назначенные админы канала.",
};

type ChannelDraft = {
  title: string;
  writeMode: WriteMode;
  managerUsernames: string;
  relatedFranchise: string;
  relatedEventDate: string;
  archived: boolean;
};

function emptyDraft(row?: AdminChannelRow): ChannelDraft {
  return {
    title: row?.title || "",
    writeMode: (row?.writeMode as WriteMode) || "members",
    managerUsernames: (row?.managerUsernames || []).join(", "),
    relatedFranchise: row?.relatedFranchise || "",
    relatedEventDate: row?.relatedEventDate ? row.relatedEventDate.slice(0, 16) : "",
    archived: Boolean(row?.archived),
  };
}

function formatLastActivity(row: AdminChannelRow) {
  const lm = row.lastMessage;
  if (!lm?.createdAt) return "—";
  const when = new Date(lm.createdAt).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const who = lm.sender ? `@${lm.sender}` : "";
  const preview =
    lm.type === "image"
      ? "фото"
      : lm.type === "voice"
        ? "голосовое"
        : lm.type === "video"
          ? "видео"
          : (lm.text || "").slice(0, 40);
  return `${when}${who ? ` · ${who}` : ""}${preview ? `: ${preview}` : ""}`;
}

function SortableChannelRow({
  row,
  index,
  onEdit,
  onQuickWriteMode,
  onDelete,
  savingId,
}: {
  row: AdminChannelRow;
  index: number;
  onEdit: (row: AdminChannelRow) => void;
  onQuickWriteMode: (row: AdminChannelRow, mode: WriteMode) => void;
  onDelete: (row: AdminChannelRow) => void;
  savingId: string | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
    disabled: Boolean(row.archived),
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "grid grid-cols-[auto_1fr] sm:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)_auto_auto_auto] gap-2 sm:gap-3 items-center px-3 py-2.5 border border-line rounded-[6px] bg-ink/40",
        isDragging && "opacity-70 ring-1 ring-magenta z-10",
        row.archived && "opacity-60"
      )}
    >
      <button
        type="button"
        className={cn(
          "touch-none text-ink-45 hover:text-paper bg-transparent border-0 p-0",
          row.archived ? "cursor-not-allowed opacity-30" : "cursor-grab active:cursor-grabbing"
        )}
        aria-label="Перетащить"
        disabled={Boolean(row.archived)}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </button>

      <div className="min-w-0 col-span-1 sm:col-span-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[16px] leading-none shrink-0">{row.icon}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[13px] font-medium text-paper truncate">{row.title}</span>
              {row.pinned && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-amber">
                  <Pin size={10} /> закреп
                </span>
              )}
              {(row.locked || row.writeMode === "owner_only") && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-ink-45">
                  <Lock size={10} /> ограничен
                </span>
              )}
              {row.archived && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-ink-45">
                  <Archive size={10} /> архив
                </span>
              )}
            </div>
            <div className="text-[11px] text-ink-45 truncate">
              #{index + 1} · {row.id}
            </div>
          </div>
        </div>
      </div>

      <div className="col-span-2 sm:hidden space-y-2 min-w-0">
        <select
          className="field-box h-8 text-[11px] w-full"
          value={row.writeMode || "members"}
          disabled={savingId === row.id}
          onChange={(e) => onQuickWriteMode(row, e.target.value as WriteMode)}
        >
          {(Object.keys(WRITE_MODE_LABELS) as WriteMode[]).map((mode) => (
            <option key={mode} value={mode}>
              {WRITE_MODE_LABELS[mode]}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-4 text-[11px] text-ink-45">
          <span className="inline-flex items-center gap-1">
            <Users size={12} /> {row.membersCount ?? 0}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageSquare size={12} /> {row.messagesCount ?? 0}
          </span>
        </div>
        <div className="text-[10px] text-ink-45 truncate">{formatLastActivity(row)}</div>
      </div>

      <div className="hidden sm:block min-w-0">
        <select
          className="field-box h-8 text-[11px] w-full max-w-[220px]"
          value={row.writeMode || "members"}
          disabled={savingId === row.id}
          onChange={(e) => onQuickWriteMode(row, e.target.value as WriteMode)}
        >
          {(Object.keys(WRITE_MODE_LABELS) as WriteMode[]).map((mode) => (
            <option key={mode} value={mode}>
              {WRITE_MODE_LABELS[mode]}
            </option>
          ))}
        </select>
        {(row.managerUsernames?.length || 0) > 0 && (
          <div className="text-[10px] text-ink-45 mt-0.5 truncate">
            админы: {row.managerUsernames!.map((u) => `@${u}`).join(", ")}
          </div>
        )}
      </div>

      <div className="hidden sm:flex flex-col text-[11px] text-ink-45 min-w-[88px]">
        <span className="inline-flex items-center gap-1">
          <Users size={12} /> {row.membersCount ?? 0}
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageSquare size={12} /> {row.messagesCount ?? 0}
        </span>
      </div>

      <div className="hidden lg:block text-[11px] text-ink-45 min-w-0 max-w-[220px] truncate col-span-1">
        {formatLastActivity(row)}
      </div>

      <div className="flex items-center gap-1 justify-end col-span-1 sm:col-span-1">
        {!row.archived && row.conversationId && (
          <Link
            href={`/messages?tab=channels&c=${encodeURIComponent(row.id)}`}
            className="inline-flex items-center justify-center w-8 h-8 rounded-[4px] border border-line text-ink-45 hover:text-magenta hover:border-magenta/50 no-underline"
            title="Открыть канал"
          >
            <ExternalLink size={14} />
          </Link>
        )}
        <button
          type="button"
          className="inline-flex items-center justify-center w-8 h-8 rounded-[4px] border border-line text-ink-45 hover:text-magenta hover:border-magenta/50 bg-transparent"
          title="Настройки канала"
          onClick={() => onEdit(row)}
        >
          <Settings2 size={14} />
        </button>
        <button
          type="button"
          className="inline-flex items-center justify-center w-8 h-8 rounded-[4px] border border-line text-ink-45 hover:text-red-400 hover:border-red-400/50 bg-transparent disabled:opacity-40"
          title="Удалить канал"
          disabled={savingId === row.id}
          onClick={() => onDelete(row)}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export function AdminChannelManagement({
  staffUsernames,
  onHelp,
  open,
  onOpenChange,
}: {
  staffUsernames: string[];
  onHelp?: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [channels, setChannels] = useState<AdminChannelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [kindTab, setKindTab] = useState<"topic" | "region">("topic");
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [editRow, setEditRow] = useState<AdminChannelRow | null>(null);
  const [draft, setDraft] = useState<ChannelDraft>(emptyDraft());
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminChannelRow | null>(null);
  const [createDraft, setCreateDraft] = useState({
    kind: "topic" as "topic" | "region",
    title: "",
    writeMode: "members" as WriteMode,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await messagesApi.channels({ includeArchived: true });
      setChannels(mergeAdminChannels(res.channels || []));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить каналы");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return channels.filter((ch) => {
      if (ch.group !== kindTab) return false;
      if (!showArchived && ch.archived) return false;
      if (!q) return true;
      const hay = `${ch.title} ${ch.id} ${(ch.managerUsernames || []).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [channels, kindTab, query, showArchived]);

  const stats = useMemo(() => {
    const active = channels.filter((c) => !c.archived);
    return {
      total: COMMUNITY_CHANNEL_COUNT,
      active: active.length,
      archived: channels.filter((c) => c.archived).length,
      restricted: active.filter((c) => c.writeMode && c.writeMode !== "members").length,
      withAdmins: active.filter((c) => (c.managerUsernames?.length || 0) > 0).length,
    };
  }, [channels]);

  async function persistReorder(nextVisible: AdminChannelRow[]) {
    setReordering(true);
    try {
      await messagesApi.reorderChannels(kindTab, nextVisible.filter((c) => !c.archived).map((c) => c.id));
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить порядок");
    } finally {
      setReordering(false);
    }
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = visible.findIndex((c) => c.id === active.id);
    const newIndex = visible.findIndex((c) => c.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reorderedVisible = arrayMove(visible, oldIndex, newIndex);
    const reorderedIds = new Set(reorderedVisible.map((c) => c.id));
    const others = channels.filter((c) => c.group === kindTab && !reorderedIds.has(c.id));
    const merged = channels.map((c) => {
      if (c.group !== kindTab) return c;
      const idx = reorderedVisible.findIndex((x) => x.id === c.id);
      if (idx >= 0) return { ...c, sortOrder: idx + 1 };
      return c;
    });
    setChannels(merged);
    void persistReorder(reorderedVisible);
  }

  async function saveDraft() {
    if (!editRow) return;
    setSavingId(editRow.id);
    setError("");
    try {
      await messagesApi.manageChannel(editRow.id, {
        title: draft.title.trim() || editRow.title,
        writeMode: draft.writeMode,
        managerUsernames: draft.managerUsernames
          .split(",")
          .map((x) => x.trim().replace(/^@/, ""))
          .filter(Boolean),
        archived: draft.archived,
        relatedFranchise: draft.relatedFranchise.trim() || null,
        relatedEventDate: draft.relatedEventDate ? new Date(draft.relatedEventDate).toISOString() : null,
      });
      setEditRow(null);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить канал");
    } finally {
      setSavingId(null);
    }
  }

  async function quickWriteMode(row: AdminChannelRow, mode: WriteMode) {
    setSavingId(row.id);
    try {
      await messagesApi.manageChannel(row.id, { writeMode: mode });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось изменить режим записи");
    } finally {
      setSavingId(null);
    }
  }

  async function createChannel() {
    if (!createDraft.title.trim()) return;
    setSavingId("create");
    try {
      const created = await messagesApi.createChannel({
        kind: createDraft.kind,
        title: createDraft.title.trim(),
      });
      if (createDraft.writeMode !== "members" && created.channelId) {
        await messagesApi.manageChannel(created.channelId, { writeMode: createDraft.writeMode });
      }
      setCreateOpen(false);
      setCreateDraft({ kind: kindTab, title: "", writeMode: "members" });
      setKindTab(createDraft.kind);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось создать канал");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteChannel(row: AdminChannelRow) {
    setSavingId(row.id);
    setError("");
    try {
      await messagesApi.deleteChannel(row.id);
      setDeleteTarget(null);
      if (editRow?.id === row.id) setEditRow(null);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось удалить канал");
    } finally {
      setSavingId(null);
    }
  }

  function requestDelete(row: AdminChannelRow) {
    setDeleteTarget(row);
  }

  function openEdit(row: AdminChannelRow) {
    setEditRow(row);
    setDraft(emptyDraft(row));
  }

  function addStaffUsername(username: string) {
    const parts = draft.managerUsernames
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    if (!parts.includes(username)) parts.push(username);
    setDraft((d) => ({ ...d, managerUsernames: parts.join(", ") }));
  }

  return (
    <AdminPanel id="admin-channels" className="p-4 mb-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <button
            type="button"
            className="flex items-start gap-2 min-w-0 flex-1 bg-transparent border-0 p-0 text-left cursor-pointer group"
            onClick={() => onOpenChange(!open)}
            aria-expanded={open}
          >
            <ChevronDown
              size={16}
              className={cn(
                "shrink-0 text-ink-45 transition-transform mt-0.5 group-hover:text-paper",
                open && "rotate-180"
              )}
            />
            <div className="min-w-0">
              <p className="font-semibold text-[14px] text-paper">Управление каналами</p>
              {!open && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <AdminBadge tone="purple">В каталоге {stats.total}</AdminBadge>
                  <AdminBadge tone="green">Активных {stats.active}</AdminBadge>
                  {stats.restricted > 0 && (
                    <AdminBadge tone="neutral">С ограничениями {stats.restricted}</AdminBadge>
                  )}
                </div>
              )}
            </div>
          </button>
          {onHelp && <AdminHelpButton onClick={onHelp} label="Справка: каналы" />}
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {open && (
            <>
              <AdminPrimaryButton variant="outline" onClick={reload} disabled={loading || reordering}>
                Обновить
              </AdminPrimaryButton>
              <AdminPrimaryButton variant="purple" onClick={() => setCreateOpen(true)}>
                <Plus size={14} /> Новый канал
              </AdminPrimaryButton>
            </>
          )}
          <AdminPrimaryButton variant="outline" onClick={() => onOpenChange(!open)}>
            {open ? "Свернуть" : "Развернуть"}
          </AdminPrimaryButton>
        </div>
      </div>

      {open && (
        <>
      <div className="flex flex-wrap gap-2 mb-3 text-[12px]">
        <AdminBadge tone="purple">В каталоге {stats.total}</AdminBadge>
        <AdminBadge tone="green">Активных {stats.active}</AdminBadge>
        <AdminBadge tone="neutral">С ограничениями {stats.restricted}</AdminBadge>
        <AdminBadge tone="neutral">С админами канала {stats.withAdmins}</AdminBadge>
        {stats.archived > 0 && <AdminBadge tone="amber">В архиве {stats.archived}</AdminBadge>}
        {reordering && <AdminBadge tone="purple">Сохраняем порядок…</AdminBadge>}
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <button
          type="button"
          className={cn(
            "px-3 py-1.5 rounded-[4px] border text-[12px]",
            kindTab === "topic" ? "border-magenta text-magenta bg-magenta/10" : "border-line text-ink-45"
          )}
          onClick={() => setKindTab("topic")}
        >
          Тематические
        </button>
        <button
          type="button"
          className={cn(
            "px-3 py-1.5 rounded-[4px] border text-[12px]",
            kindTab === "region" ? "border-magenta text-magenta bg-magenta/10" : "border-line text-ink-45"
          )}
          onClick={() => setKindTab("region")}
        >
          Регионы
        </button>
        <label className="inline-flex items-center gap-2 text-[12px] text-ink-45 ml-auto cursor-pointer">
          <input
            type="checkbox"
            className="accent-magenta"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Показывать архив
        </label>
      </div>

      <input
        className="field-box h-10 text-[12px] w-full mb-3"
        placeholder="Поиск по названию, ID или админу канала"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {error && <p className="text-amber text-[12px] mb-3">{error}</p>}

      <div className="hidden sm:grid grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)_auto_auto_auto] gap-3 px-3 pb-2 text-[10px] uppercase tracking-wide text-ink-45">
        <span />
        <span>Канал</span>
        <span>Кто пишет</span>
        <span>Участники</span>
        <span className="hidden lg:block">Активность</span>
        <span />
      </div>

      {loading ? (
        <p className="text-ink-45 text-[13px] py-6 text-center">Загрузка каналов…</p>
      ) : visible.length === 0 ? (
        <p className="text-ink-45 text-[13px] py-6 text-center">Каналы не найдены</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={visible.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {visible.map((row, index) => (
                <SortableChannelRow
                  key={row.id}
                  row={row}
                  index={index}
                  onEdit={openEdit}
                  onQuickWriteMode={quickWriteMode}
                  onDelete={requestDelete}
                  savingId={savingId}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <p className="text-[11px] text-ink-45 mt-3">
        Перетащите строку за ⋮⋮, чтобы изменить порядок в боковой панели сообщений. Архивные каналы скрыты из списка
        чатов, но остаются в базе.
      </p>
        </>
      )}

      {editRow && (
        <Modal title={`Канал: ${editRow.title}`} onClose={() => setEditRow(null)}>
          <div className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto pr-1">
            <div className="flex flex-wrap gap-2 text-[11px]">
              <AdminBadge tone="neutral">{editRow.id}</AdminBadge>
              <AdminBadge tone="neutral">{editRow.group === "region" ? "Регион" : "Тема"}</AdminBadge>
              {editRow.pinned && <AdminBadge tone="amber">Закреплён в UI</AdminBadge>}
            </div>

            <label className="text-[12px] text-ink-45 block">
              Название канала
              <input
                className="field-box mt-1 h-10 text-[13px] w-full"
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              />
            </label>

            <label className="text-[12px] text-ink-45 block">
              Кто может писать
              <select
                className="field-box mt-1 h-10 text-[13px] w-full"
                value={draft.writeMode}
                onChange={(e) => setDraft((d) => ({ ...d, writeMode: e.target.value as WriteMode }))}
              >
                {(Object.keys(WRITE_MODE_LABELS) as WriteMode[]).map((mode) => (
                  <option key={mode} value={mode}>
                    {WRITE_MODE_LABELS[mode]}
                  </option>
                ))}
              </select>
              <span className="block mt-1 text-[11px] text-ink-45">{WRITE_MODE_HINTS[draft.writeMode]}</span>
            </label>

            <label className="text-[12px] text-ink-45 block">
              Админы канала (ники через запятую)
              <input
                className="field-box mt-1 h-10 text-[13px] w-full"
                placeholder="nyx.cosplay, demo.admin"
                value={draft.managerUsernames}
                onChange={(e) => setDraft((d) => ({ ...d, managerUsernames: e.target.value }))}
              />
              {staffUsernames.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {staffUsernames.map((u) => (
                    <button
                      key={u}
                      type="button"
                      className="px-2 py-0.5 rounded-[999px] border border-line text-[11px] text-ink-45 hover:border-magenta hover:text-magenta bg-transparent"
                      onClick={() => addStaffUsername(u)}
                    >
                      + @{u}
                    </button>
                  ))}
                </div>
              )}
            </label>

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-[12px] text-ink-45 block">
                Связанная франшиза (опционально)
                <input
                  className="field-box mt-1 h-10 text-[13px] w-full"
                  value={draft.relatedFranchise}
                  onChange={(e) => setDraft((d) => ({ ...d, relatedFranchise: e.target.value }))}
                />
              </label>
              <label className="text-[12px] text-ink-45 block">
                Дата события (опционально)
                <input
                  type="datetime-local"
                  className="field-box mt-1 h-10 text-[13px] w-full"
                  value={draft.relatedEventDate}
                  onChange={(e) => setDraft((d) => ({ ...d, relatedEventDate: e.target.value }))}
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[12px] text-ink-45 bg-ink/40 border border-line rounded-[6px] p-3">
              <div>
                <div className="text-[10px] uppercase tracking-wide mb-0.5">Участников</div>
                <div className="text-paper">{editRow.membersCount ?? 0}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide mb-0.5">Сообщений</div>
                <div className="text-paper">{editRow.messagesCount ?? 0}</div>
              </div>
              <div className="col-span-2">
                <div className="text-[10px] uppercase tracking-wide mb-0.5">Последняя активность</div>
                <div className="text-paper text-[11px]">{formatLastActivity(editRow)}</div>
              </div>
            </div>

            <label className="text-[12px] text-ink-45 flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="accent-magenta"
                checked={draft.archived}
                onChange={(e) => setDraft((d) => ({ ...d, archived: e.target.checked }))}
              />
              <span className="inline-flex items-center gap-1">
                {draft.archived ? <Archive size={14} /> : <ArchiveRestore size={14} />}
                {draft.archived ? "Канал в архиве (скрыт из списка)" : "Канал активен"}
              </span>
            </label>

            <div className="flex flex-wrap gap-2 pt-1">
              <AdminPrimaryButton variant="purple" onClick={saveDraft} disabled={savingId === editRow.id}>
                Сохранить изменения
              </AdminPrimaryButton>
              {!draft.archived && editRow.conversationId && (
                <Button size="sm" variant="outline" href={`/messages?tab=channels&c=${encodeURIComponent(editRow.id)}`}>
                  Открыть в чатах
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="border-red-400/40 text-red-300 hover:bg-red-500/10"
                onClick={() => requestDelete(editRow)}
              >
                <Trash2 size={14} className="mr-1" /> Удалить
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditRow(null)}>
                Отмена
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Удалить канал?" onClose={() => setDeleteTarget(null)}>
          <div className="flex flex-col gap-3">
            <p className="text-[13px] text-paper">
              Канал <strong>{deleteTarget.title}</strong> и все сообщения в нём будут удалены безвозвратно.
            </p>
            {deleteTarget.isSystem && (
              <p className="text-[12px] text-amber">
                Это канал из каталога комьюнити. После удаления он исчезнет из списка; при перезапуске seed может
                появиться снова.
              </p>
            )}
            {(deleteTarget.messagesCount || 0) > 0 && (
              <p className="text-[12px] text-amber">
                В канале {deleteTarget.messagesCount} сообщений — они тоже будут удалены.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <AdminPrimaryButton
                variant="purple"
                onClick={() => deleteChannel(deleteTarget)}
                disabled={savingId === deleteTarget.id}
              >
                Удалить навсегда
              </AdminPrimaryButton>
              <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(null)}>
                Отмена
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {createOpen && (
        <Modal title="Новый канал" onClose={() => setCreateOpen(false)}>
          <div className="flex flex-col gap-3">
            <label className="text-[12px] text-ink-45 block">
              Группа
              <select
                className="field-box mt-1 h-10 text-[13px] w-full"
                value={createDraft.kind}
                onChange={(e) => setCreateDraft((d) => ({ ...d, kind: e.target.value as "topic" | "region" }))}
              >
                <option value="topic">Тематический канал</option>
                <option value="region">Региональный канал</option>
              </select>
            </label>
            <label className="text-[12px] text-ink-45 block">
              Название
              <input
                className="field-box mt-1 h-10 text-[13px] w-full"
                placeholder="# Новый канал"
                value={createDraft.title}
                onChange={(e) => setCreateDraft((d) => ({ ...d, title: e.target.value }))}
              />
            </label>
            <label className="text-[12px] text-ink-45 block">
              Кто может писать
              <select
                className="field-box mt-1 h-10 text-[13px] w-full"
                value={createDraft.writeMode}
                onChange={(e) => setCreateDraft((d) => ({ ...d, writeMode: e.target.value as WriteMode }))}
              >
                {(Object.keys(WRITE_MODE_LABELS) as WriteMode[]).map((mode) => (
                  <option key={mode} value={mode}>
                    {WRITE_MODE_LABELS[mode]}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-[11px] text-ink-45">
              После создания канал появится в конце списка выбранной группы. Права записи и админов можно настроить
              сразу в таблице.
            </p>
            <div className="flex gap-2">
              <AdminPrimaryButton variant="purple" onClick={createChannel} disabled={!createDraft.title.trim()}>
                Создать
              </AdminPrimaryButton>
              <Button size="sm" variant="ghost" onClick={() => setCreateOpen(false)}>
                Отмена
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </AdminPanel>
  );
}
