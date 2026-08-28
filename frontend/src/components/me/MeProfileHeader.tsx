"use client";

import { useId, useRef } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SmartImage } from "@/components/media/SmartImage";

type MeProfileHeaderProps = {
  breadcrumb: string;
  publicProfileHref: string;
  coverUrl: string | null;
  onCoverChange: (file: File) => void;
};

export function MeProfileHeader({
  breadcrumb,
  publicProfileHref,
  coverUrl,
  onCoverChange,
}: MeProfileHeaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  function pickCover() {
    inputRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onCoverChange(file);
    e.target.value = "";
  }

  return (
    <header className="me-profile-header-block">
      <button
        type="button"
        className="me-profile-cover group w-full p-0 border-0 cursor-pointer text-left"
        onClick={pickCover}
        aria-label="Изменить обложку"
      >
        {coverUrl ? (
          <SmartImage src={coverUrl} alt="Обложка профиля" className="w-full h-full object-cover" />
        ) : (
          <div className="me-profile-cover-placeholder">Обложка не задана</div>
        )}
        <span className="me-profile-cover-edit">
          <Camera size={16} strokeWidth={1.75} />
          Изменить обложку
        </span>
      </button>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onFileChange}
      />
      <div className="me-profile-header">
        <div>
          <div className="font-mono text-[11px] text-ink-45 mb-2">{breadcrumb}</div>
          <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-magenta">
            Мой профиль
          </span>
          <h1 className="font-display font-extrabold text-[26px] md:text-[30px] mt-1 leading-tight">
            МОЙ ПРОФИЛЬ
          </h1>
        </div>
        <div className="me-profile-header-actions">
          <Button href={publicProfileHref} variant="outline" size="sm">
            Смотреть публичный профиль
          </Button>
          <Button variant="outline" size="sm" type="button" onClick={pickCover}>
            Изменить обложку
          </Button>
        </div>
      </div>
    </header>
  );
}
