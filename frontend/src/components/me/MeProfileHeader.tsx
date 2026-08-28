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
  return (
    <header className="me-profile-header-block">
      <div className="me-profile-cover">
        {coverUrl ? (
          <SmartImage src={coverUrl} alt="Обложка профиля" className="w-full h-full object-cover" />
        ) : (
          <div className="me-profile-cover-placeholder">Обложка не задана</div>
        )}
      </div>
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
        <label>
          <span className="inline-flex items-center justify-center px-4 py-2 text-[12px] font-medium border border-line rounded-[4px] text-paper bg-transparent hover:border-paper cursor-pointer transition-colors">
            Изменить обложку
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onCoverChange(file);
              e.target.value = "";
            }}
          />
        </label>
        </div>
      </div>
    </header>
  );
}
