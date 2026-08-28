"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { ImageEditorModal, type ImageEditorSavePayload } from "./ImageEditorModal";

export type ImageEditorPreset = "default" | "profile-cover" | "avatar";

export type ImageEditResult = File | ImageEditorSavePayload;

type EditFn = (
  file: File,
  aspect?: number | null,
  preset?: ImageEditorPreset
) => Promise<ImageEditResult | null>;

const Ctx = createContext<EditFn>(async (file) => file);

export function ImageEditorProvider({ children }: { children: ReactNode }) {
  const [job, setJob] = useState<{
    file: File;
    aspect?: number | null;
    preset?: ImageEditorPreset;
    resolve: (file: ImageEditResult | null) => void;
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
          onSave={(payload) => {
            job.resolve(payload);
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

function resolveEditFile(result: ImageEditResult): File {
  return result instanceof File ? result : result.file;
}

export async function editImageList(
  edit: EditFn,
  files: File[],
  aspect?: number | null,
  preset?: ImageEditorPreset
): Promise<{ files: File[]; coverVariantFiles?: { tablet: File; mobile: File } }> {
  const out: File[] = [];
  let coverVariantFiles: { tablet: File; mobile: File } | undefined;
  for (const file of files) {
    if (file.type.startsWith("video/") || file.type === "image/gif" || !file.type.startsWith("image/")) {
      out.push(file);
      continue;
    }
    const next = await edit(file, aspect, preset);
    if (!next) continue;
    if (next instanceof File) {
      out.push(next);
    } else {
      out.push(next.file);
      if (next.coverVariantFiles) coverVariantFiles = next.coverVariantFiles;
    }
  }
  return { files: out, coverVariantFiles };
}

export { resolveEditFile };
