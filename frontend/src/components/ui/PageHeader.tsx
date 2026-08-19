import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  className?: string;
  children?: ReactNode;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  className,
  children,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-7", className)}>
      <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-magenta">
        {eyebrow}
      </span>
      <h1 className="font-display font-extrabold text-[28px] md:text-[32px] mt-1 leading-tight">
        {title}
      </h1>
      {description && (
        <p className="text-[14px] text-ink-70 mt-2 max-w-[560px] leading-relaxed">
          {description}
        </p>
      )}
      {children}
    </div>
  );
}
