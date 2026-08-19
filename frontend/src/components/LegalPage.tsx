"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";

export function LegalPage({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pt-12 px-4 sm:px-6 pb-20 max-w-[760px] mx-auto min-w-0">
      <PageHeader eyebrow={eyebrow} title={title} />
      <div className="text-[14px] text-ink-70 leading-relaxed space-y-4">{children}</div>
      <Link href="/explore" className="inline-block mt-8 text-[13px] text-ink-45 no-underline hover:text-paper">
        ← К Explore
      </Link>
    </div>
  );
}
