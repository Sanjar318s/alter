import { SkeletonGrid, Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="px-4 sm:px-6 py-10 max-w-[1240px] mx-auto">
      <Skeleton className="h-8 w-36 mb-6" />
      <SkeletonGrid count={6} />
    </div>
  );
}
