import { SkeletonGrid, Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="pt-11 px-4 sm:px-6 max-w-[1240px] mx-auto">
      <Skeleton className="h-8 w-40 mb-6" />
      <div className="flex gap-2 mb-6">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-28" />
      </div>
      <SkeletonGrid count={8} />
    </div>
  );
}
