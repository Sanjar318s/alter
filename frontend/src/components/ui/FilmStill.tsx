"use client";

import { useState } from "react";
import { Frame } from "@/components/Frame";
import { photoFor, posterFor } from "@/lib/poster";
import { cn } from "@/lib/cn";

type FilmStillProps = {
  seed: string;
  alt?: string;
  className?: string;
  /** Wrap in a Frame so HUD corner marks are drawn */
  framed?: boolean;
  amber?: boolean;
  muted?: boolean;
  hover?: boolean;
};

export function FilmStill({
  seed,
  alt = "",
  className,
  framed,
  amber,
  muted,
  hover,
}: FilmStillProps) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const photo = photoFor(seed);

  const inner = (
    <div
      className="absolute inset-0 overflow-hidden film-grain film-vignette"
      style={{
        backgroundImage: posterFor(seed),
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {photo && !photoFailed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setPhotoFailed(true)}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
    </div>
  );

  if (framed) {
    return (
      <Frame
        amber={amber}
        muted={muted}
        hover={hover}
        className={cn("relative", className)}
      >
        {inner}
      </Frame>
    );
  }

  return <div className={cn("relative overflow-hidden", className)}>{inner}</div>;
}
