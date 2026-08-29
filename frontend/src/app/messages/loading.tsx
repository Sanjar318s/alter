import { SkeletonMessageList } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="flex flex-1 min-h-[50vh]">
      <SkeletonMessageList className="w-full max-w-md" />
    </div>
  );
}
