import type { ReactNode } from "react";
import { Frame } from "@/components/Frame";
import { cn } from "@/lib/cn";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  amber?: boolean;
  compact?: boolean;
  className?: string;
};

export function EmptyState({
  title,
  description,
  action,
  amber,
  compact,
  className,
}: EmptyStateProps) {
  return (
    <Frame
      amber={amber}
      className={cn(
        "flex flex-col items-center text-center",
        compact ? "px-4 py-8" : "px-6 py-12",
        className
      )}
    >
      <div className="font-mono text-[11px] tracking-[0.12em] text-ink-45 mb-3">
        [ ]
      </div>
      <h3 className="font-display font-extrabold text-[18px] md:text-[20px]">
        {title}
      </h3>
      {description && (
        <p className="text-[14px] text-ink-70 mt-2 max-w-[360px] leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </Frame>
  );
}
