"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCw } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { compressImage } from "@/lib/compressImage";
import { cn } from "@/lib/cn";

const FILTERS: { id: string; label: string; css: string }[] = [
  { id: "none", label: "Без", css: "" },
  { id: "bw", label: "Ч/б", css: "grayscale(1)" },
  { id: "warm", label: "Тёплый", css: "sepia(0.25) saturate(1.15)" },
  { id: "cool", label: "Холодный", css: "hue-rotate(12deg) saturate(0.9)" },
  { id: "vivid", label: "Яркий", css: "saturate(1.45) contrast(1.08)" },
];

export function ImageEditorModal({
  file,
  aspect,
  onCancel,
  onSave,
}: {
  file: File;
  aspect?: number | null;
  onCancel: () => void;
  onSave: (file: File) => void;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [url, setUrl] = useState("");
  const [ready, setReady] = useState(false);
  const [scale, setScale] = useState(1);
  const [rot, setRot] = useState(0);
  const [ox, setOx] = useState(0);
  const [oy, setOy] = useState(0);
  const [bright, setBright] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [sat, setSat] = useState(100);
  const [filter, setFilter] = useState("none");
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const ratio = aspect && aspect > 0 ? aspect : null;
  const viewW = 320;
  const viewH = ratio ? Math.round(320 / ratio) : 320;

  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setReady(true);
    };
    img.src = u;
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const filterCss = `brightness(${bright}%) contrast(${contrast}%) saturate(${sat}%) ${FILTERS.find((f) => f.id === filter)?.css || ""}`;

  async function save() {
    const img = imgRef.current;
    if (!img || busy) return;
    setBusy(true);
    try {
      const canvas = document.createElement("canvas");
      const outW = ratio ? 1200 : Math.min(1600, img.naturalWidth);
      const outH = ratio ? Math.round(outW / ratio) : Math.round((outW / img.naturalWidth) * img.naturalHeight);
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");
      ctx.filter = filterCss;
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, outW, outH);
      ctx.save();
      ctx.translate(outW / 2, outH / 2);
      ctx.rotate((rot * Math.PI) / 180);
      const cover = Math.max(viewW / img.naturalWidth, viewH / img.naturalHeight);
      const drawScale = cover * scale;
      const dw = img.naturalWidth * drawScale * (outW / viewW);
      const dh = img.naturalHeight * drawScale * (outH / viewH);
      ctx.drawImage(img, -dw / 2 + ox * (outW / viewW), -dh / 2 + oy * (outH / viewH), dw, dh);
      ctx.restore();
      const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b || file), "image/jpeg", 0.92));
      const jpeg = new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
      const compressed = await compressImage(jpeg);
      const out = compressed instanceof File ? compressed : new File([compressed], jpeg.name, { type: compressed.type || "image/jpeg" });
      onSave(out);
    } catch {
      onCancel();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Редактор фото" onClose={onCancel} wide>
      <div className="flex flex-col gap-3">
        <div
          ref={stageRef}
          className="relative mx-auto overflow-hidden bg-ink border border-line touch-none"
          style={{ width: viewW, height: viewH }}
          onPointerDown={(e) => {
            drag.current = { x: e.clientX, y: e.clientY, ox, oy };
            (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            setOx(drag.current.ox + (e.clientX - drag.current.x));
            setOy(drag.current.oy + (e.clientY - drag.current.y));
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
        >
          {url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt=""
              draggable={false}
              className="absolute left-1/2 top-1/2 max-w-none select-none pointer-events-none"
              style={{
                transform: `translate(-50%, -50%) translate(${ox}px, ${oy}px) rotate(${rot}deg) scale(${scale})`,
                filter: filterCss,
              }}
            />
          )}
          <div className="absolute inset-0 pointer-events-none border-2 border-magenta/70" />
        </div>
        <label className="font-mono text-[11px] text-ink-45">
          Зум
          <input className="w-full" type="range" min={1} max={3} step={0.02} value={scale} onChange={(e) => setScale(Number(e.target.value))} />
        </label>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setRot((r) => (r + 90) % 360)}>
            <RotateCw size={14} className="mr-1" /> Поворот
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            ["Яркость", bright, setBright],
            ["Контраст", contrast, setContrast],
            ["Насыщенность", sat, setSat],
          ].map(([label, val, set]) => (
            <label key={String(label)} className="font-mono text-[10px] text-ink-45">
              {label as string}
              <input
                className="w-full"
                type="range"
                min={50}
                max={150}
                value={val as number}
                onChange={(e) => (set as (n: number) => void)(Number(e.target.value))}
              />
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={cn(
                "px-2 py-1 text-[11px] border bg-transparent",
                filter === f.id ? "border-magenta text-magenta" : "border-line text-ink-45"
              )}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button disabled={!ready || busy} onClick={save}>
            {busy ? "Сохраняем…" : "Сохранить"}
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Отмена
          </Button>
        </div>
      </div>
    </Modal>
  );
}
