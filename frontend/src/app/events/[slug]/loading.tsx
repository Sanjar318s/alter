import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="p-8 max-w-3xl mx-auto" role="status" aria-label="Загрузка">
      <Skeleton className="aspect-[21/9] w-full rounded-none mb-6" />
      <Skeleton className="h-8 w-2/3 mb-3" />
      <SkeletonText lines={4} />
    </div>
  );
}
