"use client";

import { StudioShell } from "@/components/StudioShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { PAYMENTS_LIVE } from "@/lib/flags";

export default function FinancePage() {
  if (!PAYMENTS_LIVE) {
    return (
      <StudioShell>
        <div className="p-4 sm:p-6 max-w-[640px]">
          <PageHeader eyebrow="Финансы" title="На бета-тестировании" />
          <p className="text-[14px] text-ink-70">
            Вывод средств и история оплат пока закрыты. Раздел откроется после запуска платежей.
          </p>
        </div>
      </StudioShell>
    );
  }
  return null;
}
