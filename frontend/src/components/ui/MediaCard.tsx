import Link from "next/link";
import { Frame } from "@/components/Frame";
import { cn } from "@/lib/cn";

const PALETTES = [
  "linear-gradient(145deg, #5C1F3A 0%, #E5487A 42%, #1D1A29 100%)",
  "linear-gradient(160deg, #4A3210 0%, #F2A93B 38%, #12101A 100%)",
  "linear-gradient(150deg, #241C48 0%, #6B5B95 45%, #12101A 100%)",
  "linear-gradient(155deg, #143636 0%, #3D8B8B 40%, #12101A 100%)",
  "linear-gradient(148deg, #3A1A2A 0%, #8B3A5A 44%, #1D1A29 100%)",
  "linear-gradient(162deg, #2A2410 0%, #8B7A3A 36%, #12101A 100%)",
  "linear-gradient(140deg, #1A2A40 0%, #4A7AB0 42%, #12101A 100%)",
  "linear-gradient(170deg, #3A1020 0%, #C45C6A 40%, #1D1A29 100%)",
];

function paletteFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h + seed.charCodeAt(i) * (i + 1)) % PALETTES.length;
  return PALETTES[h];
}

type MediaCardProps = {
  title: string;
  sub: string;
  amber?: boolean;
  href?: string;
  aspect?: string;
  className?: string;
  compact?: boolean;
  hideCaption?: boolean;
};

export function MediaCard({
  title,
  sub,
  amber,
  href,
  aspect = "aspect-[4/5]",
  className,
  compact,
  hideCaption,
}: MediaCardProps) {
  const body = (
    <>
      <Frame
        amber={amber}
        hover
        className={cn(aspect, "film-grain film-vignette")}
        style={{ background: paletteFor(title) }}
      >
        <div className="absolute inset-0 flex items-end p-3 z-[1]">
          <span className="font-display font-extrabold text-[13px] leading-tight text-paper/90 drop-shadow">
            {title}
          </span>
        </div>
      </Frame>
      {!hideCaption && (
        <div className={cn("pt-2.5", compact && "pt-2")}>
          <div className="text-[14px] font-semibold">{title}</div>
          {sub && (
            <div className="font-mono text-[11px] text-ink-45 mt-0.5">{sub}</div>
          )}
        </div>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cn("block no-underline text-paper", className)}>
        {body}
      </Link>
    );
  }

  return <div className={className}>{body}</div>;
}
