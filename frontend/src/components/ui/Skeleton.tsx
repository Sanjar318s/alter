import { cn } from "@/lib/cn";

export function Skeleton({
  className,
  rounded = "default",
}: {
  className?: string;
  rounded?: "default" | "full" | "none";
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "skeleton-block block",
        rounded === "full" && "rounded-full",
        rounded === "none" && "rounded-none",
        rounded === "default" && "rounded-[var(--radius-control)]",
        className
      )}
    />
  );
}

export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-3", i === lines - 1 ? "w-[62%]" : "w-full")}
        />
      ))}
    </div>
  );
}

/** Card tile for market / explore grids */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "border border-line/60 overflow-hidden bg-stage/40",
        className
      )}
      aria-hidden
    >
      <Skeleton className="aspect-[4/5] w-full rounded-none" />
      <div className="p-3 flex flex-col gap-2">
        <Skeleton className="h-3.5 w-[72%]" />
        <Skeleton className="h-3 w-[44%]" />
      </div>
    </div>
  );
}

export function SkeletonCardRow({
  count = 4,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("flex gap-4 overflow-hidden", className)}
      role="status"
      aria-label="Загрузка"
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} className="min-w-[200px] w-[220px] shrink-0" />
      ))}
    </div>
  );
}

export function SkeletonGrid({
  count = 8,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4",
        className
      )}
      role="status"
      aria-label="Загрузка"
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonProfile({ className }: { className?: string }) {
  return (
    <div className={cn("w-full", className)} role="status" aria-label="Загрузка профиля">
      <Skeleton className="w-full h-[min(42vw,280px)] rounded-none" />
      <div className="px-4 sm:px-6 lg:px-8 -mt-10 relative z-[1] max-w-[1240px] mx-auto pb-8">
        <Skeleton className="w-24 h-24 sm:w-28 sm:h-28 rounded-none border-[3px] border-ink" />
        <Skeleton className="h-8 w-48 mt-4" />
        <div className="flex gap-2 mt-3">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-36" />
        </div>
        <SkeletonText lines={2} className="mt-4 max-w-md" />
      </div>
    </div>
  );
}

export function SkeletonPage({ className }: { className?: string }) {
  return (
    <div className={cn("p-4 sm:p-6 max-w-[1240px] mx-auto w-full", className)} role="status" aria-label="Загрузка">
      <Skeleton className="h-8 w-40 mb-6" />
      <SkeletonGrid count={6} />
    </div>
  );
}

export function SkeletonMessageList({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2 p-4", className)} role="status" aria-label="Загрузка">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2">
          <Skeleton className="w-11 h-11 shrink-0 rounded-none" />
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <Skeleton className="h-3.5 w-[40%]" />
            <Skeleton className="h-3 w-[70%]" />
          </div>
        </div>
      ))}
    </div>
  );
}
