"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { commissions, uploadFile } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { useRouter } from "next/navigation";
import { editImageList, useEditImage } from "@/components/media/ImageEditorProvider";
import { SmartImage } from "@/components/media/SmartImage";

export function CommissionRequestForm({
  commissionId,
  characterDefault,
  extraNotes,
  serviceWorks,
  onClose,
}: {
  commissionId: string;
  characterDefault?: string;
  extraNotes?: string;
  serviceWorks?: { id: string; title?: string; character?: string; franchise?: string; price?: number }[];
  onClose: () => void;
}) {
  const toast = useToast();
  const router = useRouter();
  const edit = useEditImage();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [link, setLink] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const [workId, setWorkId] = useState("");

  async function addPhotos(list: FileList | File[]) {
    const edited = await editImageList(edit, Array.from(list).slice(0, 8 - files.length));
    setFiles((prev) => [...prev, ...edited].slice(0, 8));
  }

  const selectedWork = serviceWorks?.find((w) => w.id === workId);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const deadline = String(fd.get("deadline") || "");
        if (!deadline) {
          toast("Укажите срок выполнения", true);
          return;
        }
        setBusy(true);
        try {
          const urls: string[] = [];
          for (const file of files.slice(0, 8)) {
            const up = await uploadFile(file, file.name, file.type);
            urls.push(up.url);
          }
          const extraLinks = [...links];
          if (link.trim()) extraLinks.push(link.trim());
          const workLine = selectedWork
            ? `Работа: ${selectedWork.title || selectedWork.character || selectedWork.id}`
            : workId === "custom"
              ? "Индивидуальный запрос"
              : "";
          const description = [workLine, String(fd.get("description") || "").trim(), extraNotes].filter(Boolean).join("\n");
          const res = await commissions.request(commissionId, {
            character: String(fd.get("character") || selectedWork?.character || characterDefault || ""),
            budget: Number(fd.get("budget") || selectedWork?.price || 0) || undefined,
            description,
            notes: description,
            referenceUrls: urls,
            links: extraLinks,
            deadline,
          });
          onClose();
          router.push(`/messages/${res.conversationId}`);
        } catch (err) {
          toast(err instanceof Error ? err.message : "Не удалось отправить заявку", true);
        } finally {
          setBusy(false);
        }
      }}
    >
      {serviceWorks && serviceWorks.length > 0 && (
        <label className="flex flex-col gap-1 text-[12px] text-ink-45">
          Работа / услуга
          <select
            className="field"
            value={workId}
            onChange={(e) => setWorkId(e.target.value)}
          >
            <option value="">Выберите работу</option>
            {serviceWorks.map((w) => (
              <option key={w.id} value={w.id}>
                {w.title || w.character || "Работа"}
                {w.franchise ? ` · ${w.franchise}` : ""}
                {w.price ? ` · от ${w.price}` : ""}
              </option>
            ))}
            <option value="custom">Индивидуальный запрос</option>
          </select>
        </label>
      )}
      <div>
        <div className="text-[12px] text-ink-45 mb-1">Референсы</div>
        <div className="flex gap-2">
          <input
            className="field flex-1"
            placeholder="Ссылка: Pinterest, Drive, пост"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (link.trim()) {
                  setLinks((p) => [...p, link.trim()]);
                  setLink("");
                }
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (link.trim()) {
                setLinks((p) => [...p, link.trim()]);
                setLink("");
              }
            }}
          >
            Добавить ссылку
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            Прикрепить фото
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addPhotos(e.target.files);
            e.target.value = "";
          }}
        />
        {(files.length > 0 || links.length > 0) && (
          <div className="flex flex-wrap gap-2 mt-2">
            {files.map((f, i) => (
              <button
                key={f.name + i}
                type="button"
                className="w-14 h-14 overflow-hidden border border-line p-0"
                onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
              >
                <SmartImage src={URL.createObjectURL(f)} alt="" fallback={f.name} />
              </button>
            ))}
            {links.map((u) => (
              <button
                key={u}
                type="button"
                className="font-mono text-[11px] text-ink-45 border border-line px-2 py-1 bg-transparent"
                onClick={() => setLinks((prev) => prev.filter((x) => x !== u))}
              >
                {u.slice(0, 32)}
              </button>
            ))}
          </div>
        )}
      </div>
      <label className="flex flex-col gap-1 text-[12px] text-ink-45">
        Персонаж
        <input
          name="character"
          className="field"
          required
          defaultValue={characterDefault || ""}
          key={selectedWork?.character || characterDefault || "char"}
          placeholder="Raiden Shogun"
          readOnly={Boolean(characterDefault) && !selectedWork}
        />
      </label>
      <label className="flex flex-col gap-1 text-[12px] text-ink-45">
        Бюджет, сум
        <input
          name="budget"
          className="field"
          type="number"
          min={0}
          placeholder="800000"
          defaultValue={selectedWork?.price || undefined}
          key={selectedWork?.id || "budget"}
        />
      </label>
      <label className="flex flex-col gap-1 text-[12px] text-ink-45">
        Срок выполнения до
        <input name="deadline" className="field" type="date" required />
      </label>
      <label className="flex flex-col gap-1 text-[12px] text-ink-45">
        Описание
        <textarea name="description" className="field-box block w-full" rows={4} placeholder="Что нужно сшить, посадка…" />
      </label>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>{busy ? "Отправляем…" : "Отправить заявку"}</Button>
        <Button type="button" variant="outline" onClick={onClose}>Отмена</Button>
      </div>
    </form>
  );
}
