"use client";

import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { MentionTagInput, type MentionChip } from "./MentionTagInput";
import { uploadFile } from "@/lib/api";
import { SmartImage } from "@/components/media/SmartImage";
import { editImageList, useEditImage } from "@/components/media/ImageEditorProvider";

type CreatePayload = {
  caption: string;
  mediaUrls: string[];
  tags: string[];
  mentions: MentionChip[];
  kind: "post";
  socialCrosspostOptIn: boolean;
};

export function CreatePublicationModal({
  onClose,
  onSubmit,
  defaultSocialOptIn = true,
}: {
  onClose: () => void;
  onSubmit: (payload: CreatePayload) => Promise<void>;
  defaultSocialOptIn?: boolean;
}) {
  const [caption, setCaption] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [mentions, setMentions] = useState<MentionChip[]>([]);
  const [files, setFiles] = useState<{ id: string; preview: string; url?: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [socialOptIn, setSocialOptIn] = useState(defaultSocialOptIn);
  const fileRef = useRef<HTMLInputElement>(null);
  const edit = useEditImage();

  async function handleFiles(list: FileList | File[]) {
    const raw = Array.from(list).slice(0, 10 - files.length);
    const items = await editImageList(edit, raw);
    for (const file of items) {
      const preview = URL.createObjectURL(file);
      let url = preview;
      try {
        const up = await uploadFile(file, file.name, file.type);
        url = up.url;
      } catch {
        /* local preview */
      }
      setFiles((prev) => [...prev, { id: `${file.name}-${Date.now()}`, preview, url }].slice(0, 10));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!files.length) return;
    setSubmitting(true);
    try {
      const tagFromCaption = (caption.match(/#[\w\u0400-\u04FF]+/g) || []).map((t) => t.slice(1).toLowerCase());
      const mentionFromCaption = (caption.match(/@[\w.]+/g) || []).map((m) => m.slice(1));
      const allTags = [...new Set([...tags, ...tagFromCaption])];
      const captionMentions: MentionChip[] = mentionFromCaption
        .filter((u) => !mentions.some((m) => m.username === u))
        .map((u) => ({ id: `c-${u}`, displayName: u, type: "user" as const, username: u }));

      await onSubmit({
        caption,
        mediaUrls: files.map((f) => f.url || f.preview),
        tags: allTags,
        mentions: [...mentions, ...captionMentions],
        kind: "post",
        socialCrosspostOptIn: socialOptIn,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Новый рилс" onClose={onClose} wide>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />

        <div
          className="border border-dashed border-line rounded-[4px] p-4 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
          }}
        >
          {files.length === 0 ? (
            <>
              <p className="text-[13px] text-ink-70">Перетащите фото или видео</p>
              <Button type="button" variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => fileRef.current?.click()}>
                <ImagePlus size={14} />
                Выбрать файл
              </Button>
            </>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {files.map((f) => (
                <div key={f.id} className="relative aspect-square">
                  <div className="w-full h-full overflow-hidden">
                    <SmartImage src={f.preview} alt="" fallback="upload" />
                  </div>
                  <button
                    type="button"
                    className="absolute top-1 right-1 w-6 h-6 bg-ink/90 border border-line flex items-center justify-center"
                    onClick={() => setFiles((prev) => prev.filter((x) => x.id !== f.id))}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {files.length < 10 && (
                <button type="button" className="aspect-square border border-dashed border-line flex items-center justify-center text-ink-45 bg-transparent" onClick={() => fileRef.current?.click()}>
                  <ImagePlus size={20} />
                </button>
              )}
            </div>
          )}
        </div>

        <label className="block">
          <span className="text-[12px] text-ink-45">Описание</span>
          <textarea
            className="field-box mt-1.5 min-h-[88px] resize-y"
            maxLength={2200}
            placeholder="Расскажите о съёмке… #тег @username"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
          <span className="block mt-1 font-mono text-[10px] text-ink-45 text-right">{caption.length}/2200</span>
        </label>

        <MentionTagInput tags={tags} mentions={mentions} onTagsChange={setTags} onMentionsChange={setMentions} />

        <label className="flex items-start gap-2 text-[12px] text-ink-70 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={socialOptIn}
            onChange={(e) => setSocialOptIn(e.target.checked)}
          />
          <span>
            Разрешить репост в YouTube / Instagram / Facebook / TikTok аккаунтов AlterCosPlay.
            <span className="block text-ink-45 mt-0.5">Может появиться в TikTok и других соцсетях бренда.</span>
          </span>
        </label>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Отмена</Button>
          <Button type="submit" disabled={!files.length || submitting}>
            {submitting ? "Публикация…" : "Опубликовать"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
