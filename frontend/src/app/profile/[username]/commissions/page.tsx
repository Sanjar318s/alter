"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Frame } from "@/components/Frame";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { users } from "@/lib/api";
import { useLocale } from "@/lib/LocaleContext";

export default function CommissionsPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = use(params);
  const { formatSum, t } = useLocale();
  const [profile, setProfile] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    users
      .get(username)
      .then(setProfile)
      .catch((e) => setError(e.message));
  }, [username]);

  const list = profile?.commissions || [];
  const p = profile?.profile;

  return (
    <div className="pt-12 px-4 sm:px-6 pb-20 max-w-[800px] mx-auto min-w-0">
      <PageHeader
        eyebrow="Коммишены"
        title={`Заказы ${username}`}
        description="Слоты, сроки и средний чек. Заявку можно отправить с профиля."
      />
      {error && <p className="text-amber text-[13px] mb-4">{error}</p>}
      {list.length === 0 && <EmptyState title="Нет открытых предложений" />}
      {list.map((c: any) => (
        <Frame key={c.id} className="p-6 bg-stage mb-3">
          <Badge status={c.status} />
          <div className="font-display font-bold mt-3">{c.title}</div>
          <div className="mt-2 text-[14px] text-ink-70 space-y-2">
            {c.description && <p>{c.description}</p>}
            {c.priceFrom != null && <p>{t("from")} {formatSum(c.priceFrom)}</p>}
            {c.turnaroundDays && <p>Срок: {c.turnaroundDays} дней</p>}
          </div>
        </Frame>
      ))}
      {p && list.length === 0 && (
        <Frame className="p-6 bg-stage">
          <p className="text-[14px] text-ink-70">
            {p.commissionTypes || "Типы работ не указаны"}. {p.commissionDuration || ""}
          </p>
        </Frame>
      )}
      <Button href={`/profile/${username}`} className="mt-6">
        Запросить с профиля
      </Button>
      <Link href={`/profile/${username}`} className="block mt-6 text-[13px] text-ink-45">
        ← Назад в профиль
      </Link>
    </div>
  );
}
