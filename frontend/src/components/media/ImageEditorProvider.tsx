"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { ImageEditorModal } from "./ImageEditorModal";

export type ImageEditorPreset = "default" | "profile-cover" | "avatar";

type EditFn = (
  file: File,
  aspect?: number | null,
  preset?: ImageEditorPreset
) => Promise<File | null>;

const Ctx = createContext<EditFn>(async (file) => file);

export function ImageEditorProvider({ children }: { children: ReactNode }) {
  const [job, setJob] = useState<{
    file: File;
    aspect?: number | null;
    preset?: ImageEditorPreset;
    resolve: (file: File | null) => void;
  } | null>(null);

  const edit = useCallback<EditFn>((file, aspect, preset = "default") => {
    if (!file.type.startsWith("image/") || file.type === "image/gif") return Promise.resolve(file);
    return new Promise((resolve) =>
      setJob({ file, aspect: aspect ?? null, preset, resolve })
    );
  }, []);

  return (
    <Ctx.Provider value={edit}>
      {children}
      {job && (
        <ImageEditorModal
          file={job.file}
          aspect={job.aspect}
          preset={job.preset ?? "default"}
          onCancel={() => {
            job.resolve(null);
            setJob(null);
          }}
          onSave={(file) => {
            job.resolve(file);
            setJob(null);
          }}
        />
      )}
    </Ctx.Provider>
  );
}

export function useEditImage() {
  return useContext(Ctx);
}

export async function editImageList(
  edit: EditFn,
  files: File[],
  aspect?: number | null,
  preset?: ImageEditorPreset
) {
  const out: File[] = [];
  for (const file of files) {
    if (file.type.startsWith("video/") || file.type === "image/gif" || !file.type.startsWith("image/")) {
      out.push(file);
      continue;
    }
    const next = await edit(file, aspect, preset);
    if (next) out.push(next);
  }
  return out;
}
