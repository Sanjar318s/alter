import { cn } from "@/lib/cn";

type CountBadgeProps = {
  count: number | string;
  /** Compact circle for icon overlays (bell, etc.) */
  dot?: boolean;
  className?: string;
};

export function CountBadge({ count, dot, className }: CountBadgeProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        "font-mono tabular-nums leading-none font-medium text-paper",
        "bg-gradient-to-b from-magenta to-[#c93a66]",
        "ring-1 ring-ink/90 shadow-[0_0_12px_rgba(229,72,122,0.32)]",
        dot
          ? "min-w-[18px] h-[18px] px-1 text-[9px] rounded-full"
          : "min-w-[22px] h-[19px] px-1.5 text-[10px] rounded-[4px]",
        className
      )}
    >
      {count}
    </span>
  );
}
