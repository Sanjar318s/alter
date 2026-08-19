import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";

interface FrameProps {
  amber?: boolean;
  muted?: boolean;
  success?: boolean;
  hover?: boolean;
  /** Allow corner marks / stickers to extend outside bounds */
  bleed?: boolean;
  /** Transparent fill — HUD marks only */
  hollow?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export function Frame({
  amber,
  muted,
  success,
  hover,
  bleed,
  hollow,
  className = "",
  style,
  children,
}: FrameProps) {
  return (
    <div
      className={cn(
        "frame",
        amber && "amber",
        muted && "muted",
        success && "success",
        hover && "frame-hover",
        bleed && "frame-bleed",
        hollow && "frame-hollow",
        className
      )}
      style={style}
    >
      <span className="cm-tl" />
      <span className="cm-tr" />
      <span className="cm-bl" />
      <span className="cm-br" />
      {children}
    </div>
  );
}
