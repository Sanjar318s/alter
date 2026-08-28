"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Monitor, Plus, RotateCw, Smartphone, Tablet, User } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { compressImage } from "@/lib/compressImage";
import { cn } from "@/lib/cn";
import { COVER_DEVICE_ASPECT } from "@/lib/coverCrop";
import type { ImageEditorPreset } from "./ImageEditorProvider";

const FILTERS: { id: string; label: string; css: string }[] = [
  { id: "none", label: "Без", css: "" },
  { id: "bw", label: "Ч/б", css: "grayscale(1)" },
  { id: "warm", label: "Тёплый", css: "sepia(0.25) saturate(1.15)" },
  { id: "cool", label: "Холодный", css: "hue-rotate(12deg) saturate(0.9)" },
  { id: "vivid", label: "Яркий", css: "saturate(1.45) contrast(1.08)" },
];

const PRESET_META: Record<
  ImageEditorPreset,
  { title: string; hint?: string; frameLabel?: string }
> = {
  default: { title: "Редактор фото" },
  "profile-cover": {
    title: "Обложка профиля",
    hint: "Выберите устройство и подберите кадр. Квадрат снизу слева — зона аватара. Сохраняется кадр для ПК, планшета и телефона.",
    frameLabel: "16:5",
  },
  avatar: {
    title: "Аватар",
    hint: "Квадрат 1:1 — так аватар будет виден в профиле.",
    frameLabel: "1:1",
  },
};

type CoverDeviceId = "desktop" | "tablet" | "mobile";

type CropState = { scale: number; ox: number; oy: number };

const COVER_DEVICES: {
  id: CoverDeviceId;
  label: string;
  aspect: number;
  viewW: number;
  frameLabel: string;
  Icon: typeof Monitor;
}[] = [
  { id: "desktop", label: "ПК", aspect: COVER_DEVICE_ASPECT.desktop, viewW: 400, frameLabel: "16:5", Icon: Monitor },
  { id: "tablet", label: "Планшет", aspect: COVER_DEVICE_ASPECT.tablet, viewW: 360, frameLabel: "16:6", Icon: Tablet },
  { id: "mobile", label: "Телефон", aspect: COVER_DEVICE_ASPECT.mobile, viewW: 300, frameLabel: "5:4", Icon: Smartphone },
];

const DEFAULT_CROPS: Record<CoverDeviceId, CropState> = {
  desktop: { scale: 1, ox: 0, oy: 0 },
  tablet: { scale: 1, ox: 0, oy: 0 },
  mobile: { scale: 1, ox: 0, oy: 0 },
};

function clampZoom(value: number) {
  return Math.min(3, Math.max(0.5, value));
}

export type ImageEditorSavePayload = {
  file: File;
  coverVariantFiles?: { tablet: File; mobile: File };
};

export function ImageEditorModal({
  file,
  aspect,
  preset = "default",
  onCancel,
  onSave,
}: {
  file: File;
  aspect?: number | null;
  preset?: ImageEditorPreset;
  onCancel: () => void;
  onSave: (payload: ImageEditorSavePayload) => void;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [url, setUrl] = useState("");
  const [ready, setReady] = useState(false);
  const [device, setDevice] = useState<CoverDeviceId>("desktop");
  const [crops, setCrops] = useState<Record<CoverDeviceId, CropState>>(DEFAULT_CROPS);
  const [rot, setRot] = useState(0);
  const [bright, setBright] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [sat, setSat] = useState(100);
  const [filter, setFilter] = useState("none");
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const meta = PRESET_META[preset];
  const isProfileCover = preset === "profile-cover";
  const activeDevice = isProfileCover
    ? COVER_DEVICES.find((d) => d.id === device) || COVER_DEVICES[0]
    : null;
  const ratio = isProfileCover && activeDevice ? activeDevice.aspect : aspect && aspect > 0 ? aspect : null;
  const viewW = isProfileCover && activeDevice ? activeDevice.viewW : 320;
  const viewH = ratio ? Math.round(viewW / ratio) : 320;
  const frameLabel = isProfileCover && activeDevice ? activeDevice.frameLabel : meta.frameLabel;
  const crop = crops[device];
  const { scale, ox, oy } = crop;

  const avatarSize = Math.round(viewW * 0.2);
  const avatarLeft = Math.round(viewW * 0.04);
  const avatarBottom = Math.round(-avatarSize * 0.42);
  const [natW, setNatW] = useState(0);
  const [natH, setNatH] = useState(0);

  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    setReady(false);
    setCrops(DEFAULT_CROPS);
    setDevice("desktop");
    setRot(0);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setNatW(img.naturalWidth);
      setNatH(img.naturalHeight);
      setReady(true);
    };
    img.src = u;
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const filterCss = `brightness(${bright}%) contrast(${contrast}%) saturate(${sat}%) ${FILTERS.find((f) => f.id === filter)?.css || ""}`;
  const coverBase = natW > 0 && natH > 0 ? Math.max(viewW / natW, viewH / natH) : 1;
  const previewScale = coverBase * scale;

  function updateCrop(patch: Partial<CropState>) {
    setCrops((prev) => ({
      ...prev,
      [device]: { ...prev[device], ...patch },
    }));
  }

  function bumpZoom(delta: number) {
    updateCrop({ scale: clampZoom(Number((scale + delta).toFixed(2))) });
  }

  function renderCropToCanvas(
    targetViewW: number,
    targetAspect: number,
    cropState: CropState,
    outW: number
  ) {
    const img = imgRef.current;
    if (!img) throw new Error("no image");
    const targetViewH = Math.round(targetViewW / targetAspect);
    const canvas = document.createElement("canvas");
    const outH = Math.round(outW / targetAspect);
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
    const base = Math.max(targetViewW / img.naturalWidth, targetViewH / img.naturalHeight);
    const drawScale = base * cropState.scale;
    const dw = img.naturalWidth * drawScale * (outW / targetViewW);
    const dh = img.naturalHeight * drawScale * (outH / targetViewH);
    ctx.drawImage(
      img,
      -dw / 2 + cropState.ox * (outW / targetViewW),
      -dh / 2 + cropState.oy * (outH / targetViewH),
      dw,
      dh
    );
    ctx.restore();
    return canvas;
  }

  async function canvasToFile(canvas: HTMLCanvasElement, name: string) {
    const blob: Blob = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b || new Blob()), "image/jpeg", 0.92)
    );
    const jpeg = new File([blob], name, { type: "image/jpeg" });
    const compressed = await compressImage(jpeg);
    return compressed instanceof File
      ? compressed
      : new File([compressed], jpeg.name, { type: compressed.type || "image/jpeg" });
  }

  async function save() {
    const img = imgRef.current;
    if (!img || busy) return;
    setBusy(true);
    try {
      const outW = isProfileCover ? 1200 : ratio ? 1200 : Math.min(1600, img.naturalWidth);

      if (isProfileCover) {
        const [desktopFile, tabletFile, mobileFile] = await Promise.all(
          COVER_DEVICES.map(async (d, i) => {
            const canvas = renderCropToCanvas(d.viewW, d.aspect, crops[d.id], outW);
            const suffix = i === 0 ? "desktop" : d.id;
            return canvasToFile(canvas, file.name.replace(/\.[^.]+$/, "") + `-${suffix}.jpg`);
          })
        );
        onSave({
          file: desktopFile,
          coverVariantFiles: { tablet: tabletFile, mobile: mobileFile },
        });
        return;
      }

      const exportAspect = ratio || viewW / viewH;
      const canvas = renderCropToCanvas(viewW, exportAspect, crop, outW);
      const out = await canvasToFile(canvas, file.name.replace(/\.[^.]+$/, "") + ".jpg");
      onSave({ file: out });
    } catch {
      onCancel();
    } finally {
      setBusy(false);
    }
  }

  const showFilters = preset === "default";

  return (
    <Modal title={meta.title} onClose={onCancel} wide>
      <div className="flex flex-col gap-3">
        {meta.hint ? (
          <p className="text-[12px] text-ink-70 leading-relaxed">{meta.hint}</p>
        ) : null}

        {isProfileCover ? (
          <div className="flex flex-wrap gap-2">
            {COVER_DEVICES.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setDevice(id)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] border bg-transparent transition-colors",
                  device === id ? "border-magenta text-magenta" : "border-line text-ink-45 hover:text-paper"
                )}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-45">
          <span>Область кадрирования</span>
          {frameLabel ? <span>{frameLabel}</span> : null}
        </div>

        <div
          ref={stageRef}
          className="relative mx-auto overflow-visible bg-ink border border-line touch-none"
          style={{ width: viewW, height: viewH }}
          onPointerDown={(e) => {
            drag.current = { x: e.clientX, y: e.clientY, ox, oy };
            (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            updateCrop({
              ox: drag.current.ox + (e.clientX - drag.current.x),
              oy: drag.current.oy + (e.clientY - drag.current.y),
            });
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
        >
          <div className="absolute inset-0 overflow-hidden">
            {url && natW > 0 && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt=""
                draggable={false}
                width={natW}
                height={natH}
                className="absolute left-1/2 top-1/2 max-w-none select-none pointer-events-none"
                style={{
                  transform: `translate(-50%, -50%) translate(${ox}px, ${oy}px) rotate(${rot}deg) scale(${previewScale})`,
                  filter: filterCss,
                }}
              />
            )}
            <div className="absolute inset-0 pointer-events-none border-2 border-magenta/70" />
          </div>

          {isProfileCover && (
            <div
              className="absolute z-10 pointer-events-none rounded-[8px] border-2 border-dashed border-paper/90 bg-ink/50 backdrop-blur-[1px] flex flex-col items-center justify-center gap-0.5"
              style={{
                width: avatarSize,
                height: avatarSize,
                left: avatarLeft,
                bottom: avatarBottom,
              }}
              aria-hidden
            >
              <User size={18} className="text-paper/80" strokeWidth={1.75} />
              <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-paper/75">
                Аватар
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-3">
          <Button type="button" variant="outline" size="sm" aria-label="Уменьшить" onClick={() => bumpZoom(-0.1)}>
            <Minus size={14} />
          </Button>
          <span className="font-mono text-[12px] text-paper min-w-[3.5rem] text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button type="button" variant="outline" size="sm" aria-label="Увеличить" onClick={() => bumpZoom(0.1)}>
            <Plus size={14} />
          </Button>
        </div>

        <label className="font-mono text-[11px] text-ink-45">
          Масштаб
          <input
            className="w-full"
            type="range"
            min={0.5}
            max={3}
            step={0.02}
            value={scale}
            onChange={(e) => updateCrop({ scale: clampZoom(Number(e.target.value)) })}
          />
        </label>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setRot((r) => (r + 90) % 360)}>
            <RotateCw size={14} className="mr-1" /> Поворот
          </Button>
        </div>

        {showFilters && (
          <>
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
          </>
        )}

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
