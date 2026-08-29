"use client";

import { Suspense, use } from "react";
import MessagesInner from "../MessagesInner";
import { SkeletonMessageList } from "@/components/ui/Skeleton";

export default function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <Suspense fallback={<SkeletonMessageList className="p-6" />}>
      <MessagesInner conversationId={id} />
    </Suspense>
  );
}
