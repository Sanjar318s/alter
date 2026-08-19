"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Stepper } from "@/components/ui/Stepper";
import { SmartImage } from "@/components/media/SmartImage";
import { builds as buildsApi, uploadFile, users } from "@/lib/api";
import { compressImage } from "@/lib/compressImage";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { editImageList, useEditImage } from "@/components/media/ImageEditorProvider";

const FRANCHISES = [
  "Genshin Impact",
  "Honkai: Star Rail",
  "League of Legends",
  "Vocaloid",
  "Nier: Automata",
  "Chainsaw Man",
  "Demon Slayer",
  "Jujutsu Kaisen",
  "Overwatch",
];

const WORK = [
  { id: "cosplay", label: "Косплей" },
  { id: "craft", label: "Крафт" },
  { id: "makeup", label: "Мейкап" },
  { id: "wig", label: "Парик" },
  { id: "3d", label: "3D-печать" },
];

const ROLES = [
  { id: "photographer", label: "Фотограф" },
  { id: "maker", label: "Мейкер" },
  { id: "makeup", label: "Визажист" },
  { id: "assistant", label: "Помощник" },
];

type Photo = { url: string; preview: string };

export function CreateBuildModal({
  onClose,
  onSaved,
  initial,
}: {
  onClose: () => void;
  onSaved: () => void;
  initial?: any;
}) {
  const toast = useToast();
  const edit = useEditImage();
  const [step, setStep] = useState(1);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [cover, setCover] = useState(initial?.coverImageUrl || "");
  const [title, setTitle] = useState(initial?.title || "");
  const [franchise, setFranchise] = useState(initial?.franchise || "");
  const [character, setCharacter] = useState(initial?.character || "");
  const [year, setYear] = useState(String(initial?.year || new Date().getFullYear()));
  const [description, setDescription] = useState(initial?.description || "");
  const [workType, setWorkType] = useState(initial?.workType || "cosplay");
  const [status, setStatus] = useState(initial?.commissionStatus || "closed");
  const [price, setPrice] = useState(String(initial?.price || 0));
  const [credits, setCredits] = useState<{ username: string; role: string }[]>([]);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initial?.photos) {
      const p = initial.photos.map((x: any) => ({ url: x.imageUrl, preview: x.imageUrl }));
      setPhotos(p);
    }
  }, [initial]);

  async function addFiles(list: FileList | File[]) {
    const edited = await editImageList(edit, Array.from(list).slice(0, 10 - photos.length), 4 / 5);
    for (const file of edited) {
      const blob = await compressImage(file);
      const preview = URL.createObjectURL(file);
      try {
        const up = await uploadFile(blob, file.name, blob.type || file.type);
        setPhotos((prev) => {
          const next = [...prev, { url: up.url, preview: up.url || preview }];
          if (!cover) setCover(next[0].url);
          return next;
        });
      } catch {
        toast("Не удалось загрузить фото", true);
      }
    }
  }

  async function save() {
    if (!title.trim()) {
      toast("Нужно название", true);
      return;
    }
    setBusy(true);
    try {
      const payload = {
        title,
        franchise,
        character,
        description,
        coverImageUrl: cover,
        year: Number(year) || null,
        price: status === "open" ? Number(price) : 0,
        currency: "UZS",
        workType,
        commissionStatus: status,
        photos: photos.map((p) => ({ imageUrl: p.url })),
        credits,
      };
      if (initial?.id) await buildsApi.update(initial.id, payload);
      else await buildsApi.create(payload);
      onSaved();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Не сохранилось", true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={initial ? "Редактировать билд" : "Новый билд"} onClose={onClose} wide>
      <Stepper steps={["Фото", "Детали", "Статус"]} current={step} />
      {step === 1 && (
        <div
          className="border border-dashed border-line p-6 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
          }}
        >
          <p className="text-[13px] text-ink-70 mb-3">До 10 фото. Клик по миниатюре — обложка.</p>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && addFiles(e.target.files)} />
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>Выбрать файлы</Button>
          <div className="grid grid-cols-4 gap-2 mt-4">
            {photos.map((p) => (
              <button
                key={p.url}
                type="button"
                onClick={() => setCover(p.url)}
                className={cn("relative aspect-square overflow-hidden border p-0", cover === p.url ? "border-magenta" : "border-line")}
              >
                <SmartImage src={p.preview} alt="" />
                <span
                  className="absolute top-1 right-1 text-[10px] bg-ink px-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPhotos((prev) => prev.filter((x) => x.url !== p.url));
                  }}
                >
                  ✕
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      {step === 2 && (
        <div className="flex flex-col gap-3">
          <input className="field" placeholder="Название" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className="field" list="fr" placeholder="Франшиза" value={franchise} onChange={(e) => setFranchise(e.target.value)} />
          <datalist id="fr">{FRANCHISES.map((f) => <option key={f} value={f} />)}</datalist>
          <input className="field" placeholder="Персонаж" value={character} onChange={(e) => setCharacter(e.target.value)} />
          <input className="field" type="number" placeholder="Год" value={year} onChange={(e) => setYear(e.target.value)} />
          <textarea className="field-box" rows={4} placeholder="История создания" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            {WORK.map((w) => (
              <button key={w.id} type="button" onClick={() => setWorkType(w.id)} className={cn("px-2 py-1 text-[12px] border", workType === w.id ? "border-magenta" : "border-line")}>
                {w.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {step === 3 && (
        <div className="flex flex-col gap-3">
          <input
            className="field"
            placeholder="@username соавтора"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              if (e.target.value.length > 1) users.search(e.target.value).then((r) => setHits(r.users)).catch(() => {});
            }}
          />
          {hits.map((h) => (
            <button
              key={h.id}
              type="button"
              className="text-left text-[13px] bg-transparent border-0"
              onClick={() => {
                setCredits((p) => [...p, { username: h.username, role: "photographer" }]);
                setHits([]);
                setQ("");
              }}
            >
              {h.username}
            </button>
          ))}
          {credits.map((c, i) => (
            <div key={c.username + i} className="flex gap-2 items-center text-[13px]">
              @{c.username}
              <select className="field-box" value={c.role} onChange={(e) => setCredits((p) => p.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))}>
                {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
          ))}
          <div className="flex gap-2">
            {(["closed", "waitlist", "open"] as const).map((s) => (
              <button key={s} type="button" onClick={() => setStatus(s)} className={cn("px-2 py-1 text-[12px] border", status === s ? "border-magenta" : "border-line")}>
                {s}
              </button>
            ))}
          </div>
          {status === "open" && <input className="field" type="number" placeholder="Цена, сум" value={price} onChange={(e) => setPrice(e.target.value)} />}
        </div>
      )}
      <div className="flex justify-between mt-5">
        <Button variant="outline" type="button" onClick={() => (step > 1 ? setStep(step - 1) : onClose())}>
          {step > 1 ? "Назад" : "Отмена"}
        </Button>
        {step < 3 ? (
          <Button type="button" onClick={() => setStep(step + 1)}>Далее</Button>
        ) : (
          <Button type="button" disabled={busy} onClick={save}>{busy ? "Сохраняем…" : "Опубликовать"}</Button>
        )}
      </div>
    </Modal>
  );
}
