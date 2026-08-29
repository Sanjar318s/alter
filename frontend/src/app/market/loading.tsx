import { SkeletonGrid, Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="min-h-[50vh] px-4 sm:px-6 lg:px-8 py-10 max-w-[1240px] mx-auto">
      <Skeleton className="h-9 w-56 mb-2" />
      <Skeleton className="h-4 w-80 mb-8" />
      <SkeletonGrid count={8} />
    </div>
  );
}
