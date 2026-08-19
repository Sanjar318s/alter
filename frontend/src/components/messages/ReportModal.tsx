"use client";

import { useRef, useState } from "react";
import { ImagePlus, Paperclip, Trash2, Video } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { editImageList, useEditImage } from "@/components/media/ImageEditorProvider";

const REASONS = [
  { id: "spam", label: "Спам" },
  { id: "harassment", label: "Оскорбления и травля" },
  { id: "fraud", label: "Мошенничество" },
  { id: "inappropriate", label: "Неприемлемый контент" },
  { id: "impersonation", label: "Выдаёт себя за другого" },
  { id: "other", label: "Другое" },
] as const;

type ReasonId = (typeof REASONS)[number]["id"];

type Attachment = {
  id: string;
  file: File;
  preview: string;
  kind: "image" | "video";
};

export function ReportModal({
  targetName,
  onClose,
  onSubmit,
}: {
  targetName: string;
  onClose: () => void;
  onSubmit: (payload: {
    reason: ReasonId;
    description: string;
    files: File[];
  }) => void;
}) {
  const [reason, setReason] = useState<ReasonId | "">("");
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const edit = useEditImage();

  async function addFiles(files: FileList | File[]) {
    const next = await editImageList(edit, Array.from(files).slice(0, 5 - attachments.length));
    const mapped = next.map((file) => ({
      id: `${file.name}-${file.lastModified}`,
      file,
      preview: URL.createObjectURL(file),
      kind: file.type.startsWith("video") ? ("video" as const) : ("image" as const),
    }));
    setAttachments((prev) => [...prev, ...mapped].slice(0, 5));
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => {
      const item = prev.find((a) => a.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter((a) => a.id !== id);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) return;
    if (reason === "other" && !description.trim()) return;

    setSubmitting(true);
    try {
      onSubmit({
        reason,
        description: description.trim(),
        files: attachments.map((a) => a.file),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={`Пожаловаться на ${targetName}`} onClose={onClose} wide>
      <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
        <div>
          <p className="text-[12px] text-ink-45 mb-2">Причина жалобы</p>
          <div className="flex flex-col gap-1">
            {REASONS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setReason(item.id)}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-[4px] border text-[13px] transition-colors",
                  reason === item.id
                    ? "border-magenta bg-magenta/10 text-paper"
                    : "border-line bg-ink text-ink-70 hover:border-ink-45 hover:text-paper"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="text-[12px] text-ink-45">
            Описание
            {reason === "other" ? " *" : " (необязательно)"}
          </span>
          <textarea
            className="field-box mt-1.5 min-h-[96px] resize-y"
            placeholder="Расскажите, что произошло…"
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <span className="block mt-1 font-mono text-[10px] text-ink-45 text-right tabular-nums">
            {description.length}/2000
          </span>
        </label>

        <div>
          <p className="text-[12px] text-ink-45 mb-2">Доказательства</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files);
              e.target.value = "";
            }}
          />

          <div
            className="border border-dashed border-line rounded-[4px] p-4 text-center hover:border-magenta/50 transition-colors"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
            }}
          >
            <p className="text-[13px] text-ink-70">Скриншот, фото или видео</p>
            <p className="text-[11px] text-ink-45 mt-1">До 5 файлов · перетащите или выберите</p>
            <div className="flex justify-center gap-2 mt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => fileRef.current?.click()}
                disabled={attachments.length >= 5}
              >
                <ImagePlus size={14} />
                Фото / видео
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={() => fileRef.current?.click()}
                disabled={attachments.length >= 5}
              >
                <Paperclip size={14} />
                Прикрепить
              </Button>
            </div>
          </div>

          {attachments.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
              {attachments.map((item) => (
                <div key={item.id} className="relative aspect-square bg-ink border border-line overflow-hidden">
                  {item.kind === "image" ? (
                    <img src={item.preview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-magenta">
                      <Video size={24} />
                    </div>
                  )}
                  <button
                    type="button"
                    aria-label="Удалить файл"
                    onClick={() => removeAttachment(item.id)}
                    className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center bg-ink/90 border border-line text-paper"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button
            type="submit"
            disabled={!reason || (reason === "other" && !description.trim()) || submitting}
          >
            {submitting ? "Отправка…" : "Отправить жалобу"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
