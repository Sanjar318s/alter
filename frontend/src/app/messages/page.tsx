import { Suspense } from "react";
import MessagesInner from "./MessagesInner";
import { SkeletonMessageList } from "@/components/ui/Skeleton";

export default function MessagesPage() {
  return (
    <Suspense fallback={<SkeletonMessageList className="flex-1 p-6" />}>
      <MessagesInner />
    </Suspense>
  );
}
