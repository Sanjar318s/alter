"use client";

import { Button } from "@/components/ui/Button";
import { ActivityLineChart } from "@/components/me/ActivityLineChart";
import { PAYMENTS_LIVE } from "@/lib/flags";

type PremiumProgress = {
  youtubeReelsAt1M: number;
  youtubeReelsNeeded: number;
  platformViews: number;
  platformViewsNeeded: number;
  platformComments: number;
  platformCommentsNeeded: number;
  qualifies: boolean;
  activeGrant: { id: string; startsAt: string; endsAt: string } | null;
} | null;

type MeAccountSidebarProps = {
  complete: { percent: number; checks: Record<string, boolean> };
  isClient: boolean;
  showPremium: boolean;
  premiumProgress: PremiumProgress;
  balance: number;
  formatSum: (n: number) => string;
  activity: number[];
  profileHref: string;
  onWithdraw: () => void;
  onPrivacy: () => void;
  onExport: () => void;
  onDelete: () => void;
};

export function MeAccountSidebar({
  complete,
  isClient,
  showPremium,
  premiumProgress,
  balance,
  formatSum,
  activity,
  profileHref,
  onWithdraw,
  onPrivacy,
  onExport,
  onDelete,
}: MeAccountSidebarProps) {
  return (
    <aside className="flex flex-col gap-4">
      <div className="me-sidebar-card">
        <div className="font-mono text-[11px] text-ink-45 mb-1">
          Статус аккаунта · {complete.percent}%
        </div>
        <div className="me-progress-track">
          <div className="me-progress-fill" style={{ width: `${complete.percent}%` }} />
        </div>
        <ul className="text-[12px] text-ink-70 space-y-1">
          <li>{complete.checks?.avatar ? "✓ Аватар добавлен" : "Добавьте аватар"}</li>
          <li>{complete.checks?.bio ? "✓ Bio заполнено" : "Напишите bio"}</li>
          <li>{complete.checks?.city ? "✓ Город указан" : "Укажите город"}</li>
          {!isClient && (
            <li>{complete.checks?.portfolio ? "✓ Есть работы" : "Добавьте работу"}</li>
          )}
        </ul>
      </div>

      {showPremium && premiumProgress && (
        <div className="me-premium-card">
          <div className="font-mono text-[11px] text-amber mb-2 uppercase tracking-[0.08em]">
            Premium · blogger
          </div>
          {premiumProgress.activeGrant ? (
            <p className="text-[13px] text-paper">
              Активен до{" "}
              {new Date(premiumProgress.activeGrant.endsAt).toLocaleDateString("ru")}
            </p>
          ) : (
            <ul className="text-[12px] text-ink-70 space-y-1">
              <li>
                YouTube 1M+: {premiumProgress.youtubeReelsAt1M}/
                {premiumProgress.youtubeReelsNeeded} рилсов
              </li>
              <li>
                Просмотры: {premiumProgress.platformViews}/
                {premiumProgress.platformViewsNeeded}
              </li>
              <li>
                Комментарии: {premiumProgress.platformComments}/
                {premiumProgress.platformCommentsNeeded}
              </li>
            </ul>
          )}
        </div>
      )}

      <div className="me-sidebar-card">
        <div className="font-mono text-[11px] text-ink-45">Баланс</div>
        <div className="font-mono text-[20px] text-paper mt-1">{formatSum(balance)}</div>
        <Button
          size="sm"
          className="mt-3 w-full"
          disabled={!PAYMENTS_LIVE}
          onClick={() => PAYMENTS_LIVE && onWithdraw()}
        >
          Вывести
        </Button>
        {!PAYMENTS_LIVE && (
          <p className="font-mono text-[10px] text-amber mt-2">На бета-тестировании</p>
        )}
      </div>

      <div className="me-sidebar-card">
        <div className="font-mono text-[11px] text-ink-45 mb-2">Активность 30 дней</div>
        <ActivityLineChart values={activity} />
      </div>

      <div className="flex flex-col gap-2">
        <Button variant="outline" size="sm" href={profileHref}>
          Портфолио
        </Button>
        <Button variant="outline" size="sm" onClick={onPrivacy}>
          Приватность
        </Button>
        <Button variant="outline" size="sm" onClick={onExport}>
          Скачать данные
        </Button>
        <Button variant="danger" size="sm" onClick={onDelete}>
          Удалить аккаунт
        </Button>
      </div>
    </aside>
  );
}
