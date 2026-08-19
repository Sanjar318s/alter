"use client";

import { Suspense } from "react";
import MessagesInner from "./MessagesInner";

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="flex flex-1 items-center p-6 font-mono text-ink-45">Загрузка…</div>}>
      <MessagesInner />
    </Suspense>
  );
}
