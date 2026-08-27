"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleHelp, ShoppingBag, Clapperboard, Store } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { account } from "@/lib/api";
import { useAuth, type PlatformRole } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { useRouter } from "next/navigation";
import { APP_FEED_HOME } from "@/lib/appHome";
import { isPlatformOwnerUser } from "@/lib/owner";

const ROLES: {
  id: PlatformRole;
  title: string;
  tip: string;
  icon: typeof ShoppingBag;
}[] = [
  {
    id: "client",
    title: "Клиент",
    tip: "Смотрите работы и рилсы, заказывайте у продавцов, ведите переписку по своим заказам. Выкладывать портфолио работ нельзя.",
    icon: ShoppingBag,
  },
  {
    id: "blogger",
    title: "Блогер",
    tip: "Публикуйте рилсы и ведите публичный профиль. Работы (портфолио костюмов) недоступны — только контент. Нужна активность: новый рилс не реже чем раз в 60 дней.",
    icon: Clapperboard,
  },
  {
    id: "seller",
    title: "Продавец",
    tip: "Выкладывайте работы и рилсы, принимайте заказы в студии, отвечайте клиентам. Нужна активность: новая работа или новый рилс не реже чем раз в 60 дней.",
    icon: Store,
  },
];

export function RoleSelectModal() {
  const { user, loading, refresh } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [selected, setSelected] = useState<PlatformRole | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tipOpen, setTipOpen] = useState<PlatformRole | null>(null);

  if (loading || !user || user.platformRole || isPlatformOwnerUser(user)) return null;

  async function confirm() {
    if (!selected || !agreed || busy) return;
    setBusy(true);
    try {
      await account.patch({ platformRole: selected });
      await refresh();
      toast("Роль сохранена");
      router.replace(APP_FEED_HOME);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Не удалось сохранить роль", true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] bg-ink/90 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="bg-stage border border-line w-full sm:max-w-[560px] sm:max-h-[90vh] max-h-[94vh] overflow-y-auto p-5 sm:p-6 rounded-t-[12px] sm:rounded-[8px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="role-select-title"
      >
        <h2 id="role-select-title" className="font-display font-extrabold text-[20px] sm:text-[22px]">
          Выберите роль на AlterCosPlay
        </h2>
        <p className="text-[13px] text-ink-70 mt-2">
          Это обязательный шаг после регистрации. Без роли пользоваться платформой нельзя.
        </p>

        <p className="mt-5 text-[15px] sm:text-[16px] font-display font-bold text-amber leading-snug border border-amber/50 bg-amber/10 px-3 py-3">
          Выбор роли делается один раз. Изменить его в будущем можно только подав заявку модератору с указанием причины и объяснением деятельности.
        </p>

        <div className="flex flex-col gap-2 mt-5">
          {ROLES.map((r) => {
            const Icon = r.icon;
            return (
              <div key={r.id} className="relative">
                <button
                  type="button"
                  onClick={() => setSelected(r.id)}
                  className={cn(
                    "w-full flex items-center gap-3 text-left px-3 py-3 border bg-transparent transition-colors",
                    selected === r.id ? "border-magenta text-paper" : "border-line text-ink-70 hover:border-paper/40"
                  )}
                >
                  <Icon size={20} className={selected === r.id ? "text-magenta" : "text-ink-45"} />
                  <span className="font-display font-bold text-[15px] flex-1">{r.title}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`Что даёт роль ${r.title}`}
                    className="w-8 h-8 inline-flex items-center justify-center text-ink-45 hover:text-magenta"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTipOpen((v) => (v === r.id ? null : r.id));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        setTipOpen((v) => (v === r.id ? null : r.id));
                      }
                    }}
                  >
                    <CircleHelp size={16} />
                  </span>
                </button>
                {tipOpen === r.id && (
                  <p className="mt-1 mb-1 text-[12px] text-ink-70 leading-relaxed border border-line/80 bg-ink/60 px-3 py-2">
                    {r.tip}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <label className="mt-5 flex items-start gap-2.5 text-[13px] text-ink-70 cursor-pointer">
          <input
            type="checkbox"
            className="mt-1"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span>
            Я согласен(на) с{" "}
            <Link href="/rules" target="_blank" className="text-magenta no-underline hover:underline">
              правилами платформы
            </Link>{" "}
            и не буду иметь претензий по этим правилам, включая одноразовый выбор роли и условия активности.
          </span>
        </label>

        <Button
          className="w-full mt-5"
          disabled={!selected || !agreed || busy}
          onClick={confirm}
        >
          {busy ? "Сохраняем…" : "Подтвердить выбор роли"}
        </Button>
      </div>
    </div>
  );
}
