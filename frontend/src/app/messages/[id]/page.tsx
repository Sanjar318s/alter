"use client";

import { Suspense, use } from "react";
import MessagesInner from "../MessagesInner";

export default function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <Suspense fallback={<div className="p-6 font-mono text-ink-45">Загрузка…</div>}>
      <MessagesInner conversationId={id} />
    </Suspense>
  );
}
