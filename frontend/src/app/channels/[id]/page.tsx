"use client";

import { Suspense, use } from "react";
import MessagesInner from "../../messages/MessagesInner";
import { SkeletonMessageList } from "@/components/ui/Skeleton";

export default function ChannelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={<SkeletonMessageList className="p-6" />}>
      <MessagesInner conversationId={id} />
    </Suspense>
  );
}
