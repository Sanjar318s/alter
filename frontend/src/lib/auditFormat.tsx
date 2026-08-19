type AuditEventLike = {
  type?: string;
  actorUsername?: string | null;
  targetType?: string;
  targetId?: string;
  targetUsername?: string | null;
  payloadJson?: string | null;
  payload?: unknown;
  createdAt?: string | Date;
  severity?: string;
};

function parsePayload(e: AuditEventLike): Record<string, unknown> | null {
  if (e.payload && typeof e.payload === "object") return e.payload as Record<string, unknown>;
  if (!e.payloadJson) return null;
  try {
    return JSON.parse(e.payloadJson) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function shortId(id?: string) {
  if (!id) return "—";
  if (id.length > 16) return `#${id.slice(0, 8)}`;
  return id;
}

function userLabel(e: AuditEventLike, payload: Record<string, unknown> | null) {
  const fromPayload = payload?.username || payload?.assigneeUsername || payload?.targetUsername;
  if (typeof fromPayload === "string" && fromPayload) return `@${fromPayload}`;
  if (e.targetUsername) return `@${e.targetUsername}`;
  if (e.targetType === "user" || e.targetType === "staff") return shortId(e.targetId);
  return null;
}

function reportStatusLabel(status: unknown) {
  const s = String(status || "");
  if (s === "open") return "открыта";
  if (s === "in_review") return "в работе";
  if (s === "resolved") return "решена";
  if (s === "rejected") return "отклонена";
  if (s === "escalated") return "эскалирована";
  return s || "неизвестно";
}

function withdrawalStatusLabel(status: unknown) {
  const s = String(status || "");
  if (s === "pending") return "ожидает";
  if (s === "approved") return "одобрен";
  if (s === "rejected") return "отклонён";
  if (s === "paid") return "выплачен";
  return s || "неизвестно";
}

export function auditSeverityLabel(severity?: string) {
  if (severity === "high") return "Важно";
  if (severity === "warn") return "Внимание";
  return "Обычное";
}

export function auditSeverityTone(severity?: string) {
  if (severity === "high") return "text-[#ff98ad] border-[#ff5b7f]/50 bg-[#ff5b7f]/10";
  if (severity === "warn") return "text-amber border-amber/50 bg-amber/10";
  return "text-[#9ef2cd] border-[#6ee7b7]/50 bg-[#6ee7b7]/10";
}

export function formatAuditEvent(e: AuditEventLike) {
  const payload = parsePayload(e);
  const actorLabel = e.actorUsername ? `@${e.actorUsername}` : "Система";
  const timeLabel = e.createdAt ? new Date(e.createdAt).toLocaleString("ru-RU") : "";
  const target = userLabel(e, payload);

  let title = "Событие в системе";
  let details = "";

  switch (e.type) {
    case "admin_granted":
      title = "Назначен админ";
      details = target ? `Кому: ${target}` : "Пользователю выданы права администратора";
      break;
    case "admin_revoked":
      title = "Сняты права админа";
      details = target ? `У кого: ${target}` : "У пользователя сняты права администратора";
      break;
    case "admin_permissions_updated":
      title = "Изменены права админа";
      details = target ? `Админ: ${target}` : "Обновлены права доступа администратора";
      break;
    case "user_blocked":
      title = "Пользователь заблокирован";
      details = [
        target ? `Кого: ${target}` : null,
        payload?.reason ? `Причина: ${payload.reason}` : null,
        payload?.details ? `Комментарий: ${payload.details}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      break;
    case "user_unblocked":
      title = "Пользователь разблокирован";
      details = target ? `Кого: ${target}` : "Доступ к сайту восстановлен";
      break;
    case "auto_temp_ban_applied":
      title = "Автоматическая блокировка";
      details = [
        target ? `Кого: ${target}` : null,
        payload?.trigger === "profanity" ? "Причина: нецензурная лексика" : null,
        payload?.trigger === "reports" ? "Причина: много жалоб" : null,
        payload?.durationHours ? `Срок: ${payload.durationHours} ч.` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      break;
    case "report_assigned":
      title = "Жалоба назначена";
      details = payload?.assigneeUsername
        ? `Ответственный: @${payload.assigneeUsername}`
        : "Жалоба передана модератору";
      break;
    case "report_auto_assigned":
      title = "Жалоба назначена автоматически";
      details = payload?.assigneeUsername
        ? `Ответственный: @${payload.assigneeUsername}`
        : "Система сама выбрала модератора";
      break;
    case "report_unassigned":
      title = "Жалоба снята с назначения";
      details = "Жалоба снова в общей очереди";
      break;
    case "report_status_changed":
      title = "Изменён статус жалобы";
      details = `Было: ${reportStatusLabel(payload?.from)} → стало: ${reportStatusLabel(payload?.to)}`;
      break;
    case "report_escalated_overdue":
      title = "Просроченная жалоба поднята в приоритет";
      details = [
        payload?.priority ? `Приоритет: ${payload.priority}` : null,
        payload?.ageMinutes ? `Просрочка: ${payload.ageMinutes} мин.` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      break;
    case "moderation_settings_updated":
      title = "Изменены настройки модерации";
      details = "Обновлены правила авто-эскалации и проверок";
      break;
    case "channel_settings_updated":
      title = "Изменены настройки канала";
      details = [
        payload?.title ? `Название: ${payload.title}` : null,
        payload?.writeMode ? `Запись: ${payload.writeMode}` : null,
        payload?.archived === true ? "Канал отправлен в архив" : payload?.archived === false ? "Канал восстановлен" : null,
        payload?.managerUsernames && Array.isArray(payload.managerUsernames)
          ? `Админы: ${(payload.managerUsernames as string[]).map((u) => `@${u}`).join(", ")}`
          : null,
      ]
        .filter(Boolean)
        .join(" · ");
      break;
    case "channel_reordered":
      title = "Изменён порядок каналов";
      details = payload?.kind ? `Группа: ${payload.kind}` : "Обновлена сортировка в боковой панели";
      break;
    case "channel_deleted":
      title = "Канал удалён";
      details = payload?.title ? `«${payload.title}»` : "Канал и его сообщения удалены";
      break;
    case "withdrawal_status_changed":
      title = "Изменён статус вывода средств";
      details = `Было: ${withdrawalStatusLabel(payload?.from)} → стало: ${withdrawalStatusLabel(payload?.to)}`;
      break;
    case "profanity_detected":
      title = "Обнаружена нецензурная лексика";
      details = payload?.words && Array.isArray(payload.words)
        ? `Слова: ${(payload.words as string[]).join(", ")}`
        : "В сообщении найдены запрещённые слова";
      break;
    case "message_edited":
      title = "Сообщение отредактировано";
      details = "Пользователь изменил своё сообщение в чате";
      break;
    case "message_deleted":
      title = "Сообщение удалено";
      details = "Сообщение было удалено из чата";
      break;
    case "staff_badge_toggled":
      title = payload?.hidden ? "Бейдж админа скрыт" : "Бейдж админа показан";
      details = target ? `Пользователь: ${target}` : "Изменена видимость значка администратора";
      break;
    default:
      details = target ? `Объект: ${target}` : "";
      break;
  }

  return {
    title,
    details,
    actorLabel,
    timeLabel,
    actionLine: `Кто сделал: ${actorLabel}`,
  };
}

export function AuditEventCard({ event }: { event: AuditEventLike }) {
  const formatted = formatAuditEvent(event);
  return (
    <div className="bg-ink/55 border border-line rounded-[6px] px-3 py-2.5">
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className={`px-2 py-0.5 rounded-[999px] border text-[10px] font-medium ${auditSeverityTone(event.severity)}`}>
          {auditSeverityLabel(event.severity)}
        </span>
        <span className="text-[11px] text-ink-45 shrink-0">{formatted.timeLabel}</span>
      </div>
      <p className="text-[13px] font-semibold text-paper">{formatted.title}</p>
      {formatted.details ? <p className="text-[12px] text-ink-45 mt-1 leading-relaxed">{formatted.details}</p> : null}
      <p className="text-[11px] text-ink-45 mt-1.5">{formatted.actionLine}</p>
    </div>
  );
}
