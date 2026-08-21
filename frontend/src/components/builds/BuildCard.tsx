"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, Images } from "lucide-react";
import { CommissionBadge } from "./CommissionBadge";
import { formatCount, mediaSrc } from "@/lib/format";
import { Frame } from "@/components/Frame";
import { cn } from "@/lib/cn";

function buildAlt(character: string | undefined, title: string, maker?: string) {
  const subject = character || title;
  return maker ? `${subject} — косплей от ${maker}` : subject;
}

export function BuildCard({
  id,
  title,
  character,
  cover,
  status,
  likes,
  photos,
  makerUsername,
}: {
  id: string;
  title: string;
  character?: string;
  cover?: string | null;
  status?: string | null;
  likes?: number;
  photos?: number;
  makerUsername?: string;
}) {
  const url = mediaSrc(cover);
  const alt = buildAlt(character, title, makerUsername);
  const letter = (title || "?").replace(/^@/, "").slice(0, 1).toUpperCase();

  return (
    <Link href={`/build/${id}`} className="block no-underline text-paper group">
      <Frame hover className="relative aspect-[4/5] overflow-hidden bg-stage">
        {url ? (
          <Image
            src={url}
            alt={alt}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center bg-stage text-ink-45 font-display font-extrabold"
            aria-label={alt}
          >
            {letter}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-ink via-ink/70 to-transparent z-[1]">
          <div className="font-display font-extrabold text-[16px] leading-tight">{character || title}</div>
          <div className={cn("flex items-center gap-2 mt-1.5")}>
            {status === "open" || status === "waitlist" ? <CommissionBadge status={status} /> : null}
            <span className="font-mono text-[10px] text-ink-45 inline-flex items-center gap-1">
              <Heart size={10} /> {formatCount(likes || 0)}
            </span>
            <span className="font-mono text-[10px] text-ink-45 inline-flex items-center gap-1">
              <Images size={10} /> {photos || 1}
            </span>
          </div>
        </div>
      </Frame>
    </Link>
  );
}
