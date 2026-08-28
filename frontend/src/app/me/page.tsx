"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Trash2 } from "lucide-react";
import { StudioShell } from "@/components/StudioShell";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { BrandIcon } from "@/components/ui/BrandIcon";
import { WithdrawModal } from "@/components/finance/WithdrawModal";
import { RoleChangeRequestForm } from "@/components/RoleChangeRequestForm";
import { MeProfileHeader } from "@/components/me/MeProfileHeader";
import { MeProfileSummaryCard } from "@/components/me/MeProfileSummaryCard";
import { MePersonalInfoForm } from "@/components/me/MePersonalInfoForm";
import { MeAccountSidebar } from "@/components/me/MeAccountSidebar";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { account, auth, finance, uploadFile, users } from "@/lib/api";
import { cn } from "@/lib/cn";
import { PAYMENTS_LIVE } from "@/lib/flags";
import { useLocale } from "@/lib/LocaleContext";
import { editImageList, useEditImage } from "@/components/media/ImageEditorProvider";

const ALL_TABS = [
  { id: "info", label: "Основная информация" },
  { id: "portfolio", label: "Портфолио" },
  { id: "socials", label: "Соцсети" },
  { id: "security", label: "Безопасность" },
  { id: "notifications", label: "Уведомления" },
];

const NOTIF_LABELS: Record<string, string> = {
  orders: "Заказы",
  messages: "Сообщения",
  likes: "Лайки",
  follows: "Подписки",
  email: "Письма на почту",
};

export default function MePage() {
  return (
    <Suspense>
      <MeInner />
    </Suspense>
  );
}

function MeInner() {
  const { user, logout, refresh } = useAuth();
  const { formatSum } = useLocale();
  const toast = useToast();
  const router = useRouter();
  const edit = useEditImage();
  const sp = useSearchParams();
  const tab = sp.get("tab") === "subs" ? "info" : sp.get("tab") || "info";
  const username = user?.username || "";

  const [nick, setNick] = useState(username);
  const [display, setDisplay] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [dob, setDob] = useState("");
  const [showAge, setShowAge] = useState(false);
  const [langs, setLangs] = useState("ru");
  const [specs, setSpecs] = useState("");
  const [availability, setAvailability] = useState("open");
  const [maxOrders, setMaxOrders] = useState(4);
  const [complexity, setComplexity] = useState("");
  const [commTypes, setCommTypes] = useState("");
  const [commDuration, setCommDuration] = useState("");
  const [expYears, setExpYears] = useState("");
  const [materials, setMaterials] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [leave, setLeave] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [socials, setSocials] = useState<{ platform: string; url: string }[]>([]);
  const [socialCrosspostOptIn, setSocialCrosspostOptIn] = useState(true);
  const [notifs, setNotifs] = useState<Record<string, boolean>>({
    orders: true,
    messages: true,
    likes: true,
    follows: true,
    email: false,
  });
  const [privacy, setPrivacy] = useState({ profile: "public", orders: "private", stats: "public" });
  const [stats, setStats] = useState({ builds: 0, orders: 0, rating: "—", likes: 0 });
  const [complete, setComplete] = useState({ percent: 0, checks: {} as Record<string, boolean> });
  const [activity, setActivity] = useState<number[]>([]);
  const [balance, setBalance] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [premiumProgress, setPremiumProgress] = useState<{
    youtubeReelsAt1M: number;
    youtubeReelsNeeded: number;
    platformViews: number;
    platformViewsNeeded: number;
    platformComments: number;
    platformCommentsNeeded: number;
    qualifies: boolean;
    activeGrant: { id: string; startsAt: string; endsAt: string } | null;
  } | null>(null);

  function mark() {
    setDirty(true);
  }

  const applyProfileFromMe = useCallback((me: Awaited<ReturnType<typeof auth.me>>) => {
    const p = me.profile || {};
    setNick(me.user.username);
    setEmail(me.user.email || "");
    setSocialCrosspostOptIn(me.user.socialCrosspostOptIn !== false && me.user.socialCrosspostOptIn !== 0);
    setDisplay(p.displayName || "");
    setBio(p.bio || "");
    setCity(p.city || "");
    setPhone(p.phone || me.user.phone || "");
    setDob(p.dateOfBirth || "");
    setShowAge(Boolean(p.showAge));
    setAvailability(p.availability || "open");
    setMaxOrders(p.maxActiveOrders || 4);
    setComplexity(p.commissionComplexity || "");
    setCommTypes(p.commissionTypes || "");
    setCommDuration(p.commissionDuration || "");
    setExpYears(p.experienceYears != null ? String(p.experienceYears) : "");
    try {
      setMaterials(p.materialsJson ? JSON.parse(p.materialsJson).join(",") : "");
    } catch {
      setMaterials("");
    }
    setAvatarUrl(p.avatarUrl || null);
    setCoverUrl(p.coverUrl || null);
    try {
      setLangs(p.languagesJson ? JSON.parse(p.languagesJson).join(",") : "ru");
    } catch {
      setLangs("ru");
    }
    try {
      setSpecs(p.specializationsJson ? JSON.parse(p.specializationsJson).join(",") : "");
    } catch {
      setSpecs("");
    }
    try {
      const links = p.linksJson ? JSON.parse(p.linksJson) : {};
      setSocials(Object.entries(links).map(([platform, url]) => ({ platform, url: String(url) })));
    } catch {
      setSocials([]);
    }
  }, []);

  const refreshSidebar = useCallback(async (uname: string, platformRole?: string | null) => {
    const [completeness, fin] = await Promise.all([
      account.completeness().catch(() => ({ percent: 0, checks: {} })),
      finance.transactions().catch(() => ({ available: 0 })),
    ]);
    setComplete(completeness as { percent: number; checks: Record<string, boolean> });
    setBalance(fin.available || 0);

    const [statsRes, activityRes] = await Promise.all([
      users.stats(uname).catch(() => null),
      users.activity(uname).catch(() => null),
    ]);
    if (statsRes) {
      setStats({
        builds: statsRes.stats?.builds || 0,
        orders: statsRes.stats?.orders || 0,
        rating: statsRes.stats?.rating != null ? String(statsRes.stats.rating) : "—",
        likes: statsRes.stats?.likes || 0,
      });
    }
    if (activityRes) {
      setActivity(activityRes.activity || []);
    }
    if (platformRole === "blogger") {
      try {
        const pr = await account.premium();
        setPremiumProgress(pr.progress);
      } catch {
        setPremiumProgress(null);
      }
    }
  }, []);

  async function resetForm() {
    try {
      const me = await auth.me();
      applyProfileFromMe(me);
      await refreshSidebar(me.user.username, me.user.platformRole);
      setDirty(false);
      toast("Изменения отменены");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Не удалось сбросить", true);
    }
  }

  useEffect(() => {
    const on = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", on);
    return () => window.removeEventListener("beforeunload", on);
  }, [dirty]);

  useEffect(() => {
    let alive = true;
    Promise.all([
      auth.me(),
      account.completeness().catch(() => ({ percent: 0, checks: {} })),
      account.notificationSettings().catch(() => ({ settings: null })),
      account.privacy().catch(() => ({ settings: null })),
      finance.transactions().catch(() => ({ available: 0 })),
    ])
      .then(async ([me, _completeness, ns, pr]) => {
        if (!alive) return;
        applyProfileFromMe(me);
        if (ns.settings) setNotifs((prev) => ({ ...prev, ...ns.settings }));
        if (pr.settings) setPrivacy((prev) => ({ ...prev, ...pr.settings }));
        await refreshSidebar(me.user.username, me.user.platformRole);
      })
      .catch((e) => {
        if (alive) setLoadError(e instanceof Error ? e.message : "Не загрузить");
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyProfileFromMe, refreshSidebar]);

  function setTab(id: string) {
    if (dirty) {
      setLeave(true);
      return;
    }
    router.replace(`/me?tab=${id}`);
  }

  async function save(socialsOverride?: { platform: string; url: string }[]) {
    const links = socialsOverride ?? socials;
    try {
      await account.patch({
        username: nick,
        displayName: display,
        bio,
        city,
        phone,
        languagesJson: JSON.stringify(langs.split(",").map((s) => s.trim()).filter(Boolean)),
        specializationsJson: JSON.stringify(specs.split(",").map((s) => s.trim()).filter(Boolean)),
        availability,
        maxActiveOrders: maxOrders,
        dateOfBirth: dob,
        showAge,
        avatarUrl,
        coverUrl,
        commissionComplexity: complexity || null,
        commissionTypes: commTypes || null,
        commissionDuration: commDuration || null,
        experienceYears: expYears === "" ? null : Number(expYears),
        materialsJson: JSON.stringify(materials.split(",").map((s) => s.trim()).filter(Boolean)),
        linksJson: JSON.stringify(Object.fromEntries(links.filter((s) => s.url).map((s) => [s.platform, s.url]))),
        socialCrosspostOptIn,
      });
      if (socialsOverride) setSocials(socialsOverride);
      await refresh();
      const me = await auth.me();
      applyProfileFromMe(me);
      await refreshSidebar(me.user.username, me.user.platformRole);
      setDirty(false);
      toast("Профиль сохранён");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Не удалось сохранить", true);
    }
  }

  async function onFile(kind: "avatar" | "cover", file: File) {
    try {
      const edited = await editImageList(edit, [file], kind === "avatar" ? 1 : 16 / 9);
      const picked = edited[0];
      if (!picked) return;
      const up = await uploadFile(picked, picked.name, picked.type);
      if (kind === "avatar") {
        setAvatarUrl(up.url);
        await account.patch({ avatarUrl: up.url });
      } else {
        setCoverUrl(up.url);
        await account.patch({ coverUrl: up.url });
      }
      await refresh();
      const me = await auth.me();
      await refreshSidebar(me.user.username, me.user.platformRole);
      toast(kind === "avatar" ? "Аватар обновлён" : "Обложка обновлена");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Не удалось загрузить", true);
    }
  }

  if (loadError) {
    return (
      <StudioShell>
        <div className="p-6">
          <p className="text-ink-70 mb-3">{loadError}</p>
          <Button onClick={() => window.location.reload()}>Повторить</Button>
        </div>
      </StudioShell>
    );
  }

  const isClient = user?.platformRole === "client";
  const isSeller = user?.platformRole === "seller";
  const TABS = ALL_TABS.filter((t) => !(isClient && t.id === "portfolio"));
  const settingsTab = isClient && tab === "portfolio" ? "info" : tab;
  const primarySocial = socials.find((s) => s.url) ?? null;

  const proSettings = isSeller ? (
    <details className="me-pro-settings">
      <summary>Профессиональные настройки</summary>
      <div className="me-pro-settings-body">
        <Field label="Специализации / навыки">
          <input className="field-box" value={specs} onChange={(e) => { setSpecs(e.target.value); mark(); }} placeholder="крой, wig styling" />
        </Field>
        <Field label="Опыт (лет)">
          <input className="field-box" type="number" min={0} value={expYears} onChange={(e) => { setExpYears(e.target.value); mark(); }} />
        </Field>
        <Field label="Материалы">
          <input className="field-box" value={materials} onChange={(e) => { setMaterials(e.target.value); mark(); }} placeholder="EVA, термопластик" />
        </Field>
        <Field label="Доступность">
          <select className="field-box" value={availability} onChange={(e) => { setAvailability(e.target.value); mark(); }}>
            <option value="open">Открыт</option>
            <option value="limited">Ограничен</option>
            <option value="closed">Закрыт</option>
          </select>
        </Field>
        <Field label="Сложность заказов">
          <select className="field-box" value={complexity} onChange={(e) => { setComplexity(e.target.value); mark(); }}>
            <option value="">Не указано</option>
            <option value="Низкая">Низкая</option>
            <option value="Средняя">Средняя</option>
            <option value="Средняя–высокая">Средняя–высокая</option>
            <option value="Высокая">Высокая</option>
          </select>
        </Field>
        <Field label="Типы работ">
          <input className="field-box" value={commTypes} onChange={(e) => { setCommTypes(e.target.value); mark(); }} placeholder="Костюмы, корсеты" />
        </Field>
        <Field label="Типичный срок">
          <input className="field-box" value={commDuration} onChange={(e) => { setCommDuration(e.target.value); mark(); }} placeholder="3–6 недель" />
        </Field>
        <Field label="Макс. заказов">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => { setMaxOrders(Math.max(1, maxOrders - 1)); mark(); }}>−</Button>
            <span className="font-mono">{maxOrders}</span>
            <Button variant="outline" size="sm" onClick={() => { setMaxOrders(maxOrders + 1); mark(); }}>+</Button>
          </div>
        </Field>
      </div>
    </details>
  ) : null;

  return (
    <StudioShell>
      <div className="me-page-shell">
        <MeProfileHeader
          breadcrumb={isClient ? "Кабинет > Мой профиль" : "Студия заказов > Профиль"}
          publicProfileHref={`/profile/${username || nick}`}
          coverUrl={coverUrl}
          onCoverChange={(file) => onFile("cover", file)}
        />

        <div className="me-profile-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn("me-profile-tab", settingsTab === t.id && "me-profile-tab--active")}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="me-profile-layout">
          <div className="min-w-0">
            {settingsTab === "info" && (
              <>
                <MeProfileSummaryCard
                  nick={nick}
                  bio={bio}
                  avatarUrl={avatarUrl}
                  role={user?.platformRole}
                  primarySocial={primarySocial}
                  stats={stats}
                  onAvatarChange={(file) => onFile("avatar", file)}
                />
                <MePersonalInfoForm
                  nick={nick}
                  display={display}
                  city={city}
                  langs={langs}
                  email={email}
                  phone={phone}
                  bio={bio}
                  dob={dob}
                  showAge={showAge}
                  role={user?.platformRole}
                  socials={socials}
                  dirty={dirty}
                  isClient={isClient}
                  proSettings={proSettings}
                  onNickChange={(v) => { setNick(v); mark(); }}
                  onDisplayChange={(v) => { setDisplay(v); mark(); }}
                  onCityChange={(v) => { setCity(v); mark(); }}
                  onLangsChange={(v) => { setLangs(v); mark(); }}
                  onPhoneChange={(v) => { setPhone(v); mark(); }}
                  onBioChange={(v) => { setBio(v); mark(); }}
                  onDobChange={(v) => { setDob(v); mark(); }}
                  onShowAgeChange={(v) => { setShowAge(v); mark(); }}
                  onSocialsChange={(next) => { setSocials(next); mark(); }}
                  onSave={save}
                  onReset={resetForm}
                />
              </>
            )}

            {settingsTab === "portfolio" && !isClient && (
              <div className="me-sidebar-card">
                <p className="text-ink-70 mb-4">Те же работы, что на публичном профиле.</p>
                <Button href={`/profile/${username || nick}`}>Открыть портфолио работ</Button>
              </div>
            )}

            {settingsTab === "socials" && (
              <div className="me-sidebar-card flex flex-col gap-3 max-w-[520px]">
                <label className="flex items-start gap-2 text-[13px] text-ink-70 cursor-pointer border border-line p-3">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={socialCrosspostOptIn}
                    onChange={(e) => {
                      setSocialCrosspostOptIn(e.target.checked);
                      mark();
                    }}
                  />
                  <span>
                    <span className="text-paper">Репост в соцсети бренда AlterCosPlay</span>
                    <span className="block text-[12px] text-ink-45 mt-0.5">
                      По умолчанию для новых рилсов и работ. Можно снять галочку при публикации.
                    </span>
                  </span>
                </label>
                {socials.map((s, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <BrandIcon name={s.platform} />
                    <input className="field flex-1" value={s.platform} onChange={(e) => { const n = [...socials]; n[i].platform = e.target.value; setSocials(n); mark(); }} />
                    <input className="field flex-1" value={s.url} onChange={(e) => { const n = [...socials]; n[i].url = e.target.value; setSocials(n); mark(); }} />
                    <button type="button" onClick={() => { setSocials(socials.filter((_, j) => j !== i)); mark(); }} className="bg-transparent border-0 text-ink-45">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => { setSocials([...socials, { platform: "telegram", url: "" }]); mark(); }}>
                  Добавить
                </Button>
                <Button disabled={!dirty} onClick={() => save()}>Сохранить</Button>
              </div>
            )}

            {settingsTab === "security" && (
              <form
                className="me-sidebar-card flex flex-col gap-4 max-w-[420px]"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  try {
                    await account.password({
                      currentPassword: String(fd.get("current")),
                      newPassword: String(fd.get("next")),
                    });
                    toast("Пароль изменён");
                    e.currentTarget.reset();
                  } catch (err) {
                    toast(err instanceof Error ? err.message : "Не удалось сменить пароль", true);
                  }
                }}
              >
                <input name="current" type="password" className="field" placeholder="Текущий пароль" required autoComplete="current-password" />
                <input name="next" type="password" className="field" placeholder="Новый пароль" required minLength={6} autoComplete="new-password" />
                <Button type="submit">Сменить пароль</Button>
                <Button variant="outline" type="button" onClick={() => { logout(); }}>
                  Выйти
                </Button>
                <RoleChangeRequestForm />
              </form>
            )}

            {settingsTab === "notifications" && (
              <div className="me-sidebar-card flex flex-col gap-3 max-w-[420px]">
                {(Object.keys(NOTIF_LABELS) as string[]).map((k) => (
                  <label key={k} className="flex items-center justify-between text-[13px] border-b border-line py-2">
                    {NOTIF_LABELS[k]}
                    <input
                      type="checkbox"
                      checked={Boolean(notifs[k])}
                      onChange={async (e) => {
                        const next = { ...notifs, [k]: e.target.checked };
                        setNotifs(next);
                        try {
                          await account.patchNotificationSettings({ [k]: e.target.checked });
                        } catch (err) {
                          toast(err instanceof Error ? err.message : "Не сохранилось", true);
                        }
                      }}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>

          <MeAccountSidebar
            complete={complete}
            isClient={isClient}
            showPremium={user?.platformRole === "blogger"}
            premiumProgress={premiumProgress}
            balance={balance}
            formatSum={formatSum}
            activity={activity}
            profileHref={`/profile/${username || nick}`}
            onWithdraw={() => setWithdrawOpen(true)}
            onPrivacy={() => setPrivacyOpen(true)}
            onExport={async () => {
              try {
                const data = await account.export();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "alter-export.json";
                a.click();
              } catch (e) {
                toast(e instanceof Error ? e.message : "Экспорт не удался", true);
              }
            }}
            onDelete={() => setDeleteOpen(true)}
          />
        </div>
      </div>

      {leave && (
        <Modal title="Несохранённые изменения" onClose={() => setLeave(false)}>
          <p className="text-[13px] text-ink-70 mb-4">Сохранить перед уходом?</p>
          <div className="flex gap-2">
            <Button onClick={() => { save(); setLeave(false); }}>Сохранить</Button>
            <Button variant="outline" onClick={() => { setDirty(false); setLeave(false); }}>Уйти</Button>
          </div>
        </Modal>
      )}
      {PAYMENTS_LIVE && withdrawOpen && (
        <WithdrawModal available={balance} onClose={() => setWithdrawOpen(false)} onDone={() => finance.transactions().then((d) => setBalance(d.available || 0))} />
      )}
      {privacyOpen && (
        <Modal title="Приватность" onClose={() => setPrivacyOpen(false)}>
          <div className="flex flex-col gap-3">
            {(["profile", "orders", "stats"] as const).map((k) => (
              <label key={k} className="text-[13px]">
                {k === "profile" ? "Профиль" : k === "orders" ? "Заказы" : "Статистика"}
                <select
                  className="field-box mt-1"
                  value={privacy[k]}
                  onChange={async (e) => {
                    const next = { ...privacy, [k]: e.target.value };
                    setPrivacy(next);
                    try {
                      await account.patchPrivacy(next);
                    } catch (err) {
                      toast(err instanceof Error ? err.message : "Не сохранилось", true);
                    }
                  }}
                >
                  <option value="public">Публично</option>
                  <option value="private">Только я</option>
                </select>
              </label>
            ))}
          </div>
        </Modal>
      )}
      {deleteOpen && (
        <Modal title="Удалить аккаунт" onClose={() => setDeleteOpen(false)}>
          <p className="text-[13px] text-ink-70 mb-3">Введите DELETE для подтверждения.</p>
          <input className="field mb-4" value={deleteText} onChange={(e) => setDeleteText(e.target.value)} />
          <Button
            variant="danger"
            disabled={deleteText !== "DELETE"}
            onClick={async () => {
              try {
                await account.delete();
                logout();
                router.push("/");
              } catch (e) {
                toast(e instanceof Error ? e.message : "Не удалось удалить", true);
              }
            }}
          >
            Удалить навсегда
          </Button>
        </Modal>
      )}
    </StudioShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-[12px] text-ink-45">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}
