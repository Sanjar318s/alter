import { SkeletonCard, Skeleton, SkeletonText } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="pt-16 px-4 sm:px-6 max-w-[960px] mx-auto">
      <Skeleton className="aspect-[16/10] w-full rounded-none mb-6" />
      <Skeleton className="h-8 w-2/3 mb-3" />
      <SkeletonText lines={3} className="mb-8" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
