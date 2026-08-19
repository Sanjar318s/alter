"use client";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

const BLOCK_REASONS = [
  { id: "spam", label: "Спам / реклама" },
  { id: "abuse", label: "Оскорбления / токсичность" },
  { id: "fraud", label: "Мошенничество" },
  { id: "harassment", label: "Преследование" },
  { id: "explicit", label: "Запрещённый контент 18+" },
  { id: "other", label: "Другое" },
];

export type BlockModalState = { user: any; mode: "manual" | "blacklist" } | null;

export function BlockUserModal({
  blockModal,
  blockReason,
  blockDetails,
  blockFiles,
  blockDuration,
  blocking,
  onClose,
  onReasonChange,
  onDetailsChange,
  onDurationChange,
  onFilesChange,
  onSubmit,
}: {
  blockModal: BlockModalState;
  blockReason: string;
  blockDetails: string;
  blockFiles: File[];
  blockDuration: string;
  blocking: boolean;
  onClose: () => void;
  onReasonChange: (value: string) => void;
  onDetailsChange: (value: string) => void;
  onDurationChange: (value: string) => void;
  onFilesChange: (files: File[]) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  if (!blockModal) return null;

  const title =
    blockModal.mode === "blacklist"
      ? `Чёрный список · @${blockModal.user.username}`
      : `Блокировка · @${blockModal.user.username}`;

  return (
    <Modal title={title} onClose={onClose}>
      <form className="flex flex-col gap-3" onSubmit={onSubmit}>
        <label className="text-[12px] text-ink-45">
          Причина (обязательно)
          <select className="field-box mt-1" value={blockReason} onChange={(e) => onReasonChange(e.target.value)}>
            {BLOCK_REASONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[12px] text-ink-45">
          Комментарий
          <textarea
            className="field-box mt-1"
            rows={4}
            value={blockDetails}
            onChange={(e) => onDetailsChange(e.target.value)}
            placeholder="Подробности для команды модерации"
          />
        </label>
        <label className="text-[12px] text-ink-45">
          Срок блокировки
          <select className="field-box mt-1" value={blockDuration} onChange={(e) => onDurationChange(e.target.value)}>
            <option value="1">1 час</option>
            <option value="24">24 часа</option>
            <option value="72">3 дня</option>
            <option value="168">7 дней</option>
            <option value="720">30 дней</option>
            <option value="0">Бессрочно</option>
          </select>
        </label>
        <label className="text-[12px] text-ink-45">
          Доказательства (скриншоты)
          <input
            className="field mt-1"
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => onFilesChange(Array.from(e.target.files || []))}
          />
        </label>
        {blockFiles.length > 0 && (
          <p className="text-[11px] text-ink-45">Выбрано файлов: {blockFiles.length}</p>
        )}
        <div className="flex gap-2">
          <Button type="submit" variant={blockModal.mode === "blacklist" ? "danger" : "primary"} disabled={blocking}>
            {blocking
              ? "Сохранение..."
              : blockModal.mode === "blacklist"
                ? "Добавить в чёрный список"
                : "Заблокировать"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Отмена
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export { BLOCK_REASONS };
