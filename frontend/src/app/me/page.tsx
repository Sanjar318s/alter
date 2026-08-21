"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Camera, Trash2 } from "lucide-react";
import { StudioShell } from "@/components/StudioShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Frame } from "@/components/Frame";
import { Modal } from "@/components/ui/Modal";
import { BrandIcon } from "@/components/ui/BrandIcon";
import { SmartImage } from "@/components/media/SmartImage";
import { WithdrawModal } from "@/components/finance/WithdrawModal";
import { RoleChangeRequestForm } from "@/components/RoleChangeRequestForm";
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
  const [role, setRole] = useState("cosplayer");
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

  function mark() {
    setDirty(true);
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
      .then(async ([me, completeness, ns, pr, fin]) => {
        if (!alive) return;
        const p = me.profile || {};
        setNick(me.user.username);
        setEmail(me.user.email || "");
        setDisplay(p.displayName || "");
        setRole(me.user.roleFlags || "cosplayer");
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
        if (ns.settings) setNotifs({ ...notifs, ...ns.settings });
        if (pr.settings) setPrivacy({ ...privacy, ...pr.settings });
        setComplete(completeness as any);
        setBalance(fin.available || 0);
        try {
          const s = await users.stats(me.user.username);
          setStats({
            builds: s.stats?.builds || 0,
            orders: s.stats?.orders || 0,
            rating: s.stats?.rating != null ? String(s.stats.rating) : "—",
            likes: s.stats?.likes || 0,
          });
        } catch {
          /* skip */
        }
        try {
          const a = await users.activity(me.user.username);
          setActivity(a.activity || []);
        } catch {
          /* skip */
        }
      })
      .catch((e) => {
        if (alive) setLoadError(e instanceof Error ? e.message : "Не загрузить");
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setTab(id: string) {
    if (dirty) {
      setLeave(true);
      return;
    }
    router.replace(`/me?tab=${id}`);
  }

  async function save() {
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
        roleFlags: role,
        avatarUrl,
        coverUrl,
        commissionComplexity: complexity || null,
        commissionTypes: commTypes || null,
        commissionDuration: commDuration || null,
        experienceYears: expYears === "" ? null : Number(expYears),
        materialsJson: JSON.stringify(materials.split(",").map((s) => s.trim()).filter(Boolean)),
        linksJson: JSON.stringify(Object.fromEntries(socials.filter((s) => s.url).map((s) => [s.platform, s.url]))),
      });
      await refresh();
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

  const maxBar = Math.max(1, ...activity);
  const isClient = user?.platformRole === "client";
  const TABS = ALL_TABS.filter((t) => !(isClient && t.id === "portfolio"));
  const settingsTab = isClient && tab === "portfolio" ? "info" : tab;

  return (
    <StudioShell>
      <div className="p-4 sm:p-6 pb-20 min-w-0 max-w-full">
        <div className="font-mono text-[11px] text-ink-45 mb-2">
          {isClient ? "Кабинет > Мой профиль" : "Студия заказов > Профиль"}
        </div>
        <PageHeader eyebrow="Мой профиль" title="МОЙ ПРОФИЛЬ">
          <Button href={`/profile/${username || nick}`} variant="outline" size="sm" className="mt-3">
            Смотреть публичный профиль
          </Button>
        </PageHeader>

        <div className="flex border-b border-line mb-6 overflow-x-auto pb-px -mx-1 px-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "shrink-0 px-3 py-2 text-[13px] border-b-2 bg-transparent whitespace-nowrap",
                settingsTab === t.id ? "border-magenta text-paper" : "border-transparent text-ink-45"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8">
          <div>
            {settingsTab === "info" && (
              <>
                <div className="relative mb-8">
                  <div className="h-[180px] overflow-hidden bg-stage">
                    <SmartImage src={coverUrl} alt="Обложка" fallback="ALTER" />
                  </div>
                  <label className="absolute top-3 right-3">
                    <span className="font-mono text-[11px] px-2 py-1 bg-ink border border-line cursor-pointer">Изменить обложку</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && onFile("cover", e.target.files[0])} />
                  </label>
                  <div className="absolute -bottom-8 left-6">
                    <Frame className="w-[96px] h-[96px] ring-2 ring-magenta overflow-hidden">
                      <SmartImage src={avatarUrl} alt={nick} fallback={nick} />
                      <label className="absolute inset-0 flex items-center justify-center bg-ink/40 cursor-pointer">
                        <Camera size={18} />
                        <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && onFile("avatar", e.target.files[0])} />
                      </label>
                    </Frame>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-12 mb-8">
                  {[
                    [String(stats.builds), "Работ"],
                    [String(stats.orders), "Заказов"],
                    [stats.rating, "Рейтинг"],
                    [String(stats.likes), "Лайков"],
                  ].map(([n, l]) => (
                    <Frame key={l} className="p-3 bg-stage text-center">
                      <div className="font-mono text-[20px]">{n}</div>
                      <div className="text-[11px] text-ink-45">{l}</div>
                    </Frame>
                  ))}
                </div>
                <div className="flex flex-col gap-4 max-w-[560px]">
                  <Field label={`Ник ${nick.length}/20`}>
                    <input className="field" maxLength={20} value={nick} onChange={(e) => { setNick(e.target.value); mark(); }} />
                  </Field>
                  <Field label="Имя">
                    <input className="field" value={display} onChange={(e) => { setDisplay(e.target.value); mark(); }} />
                  </Field>
                  <Field label="Роль">
                    <select className="field-box" value={role} onChange={(e) => { setRole(e.target.value); mark(); }}>
                      <option value="cosplayer">Косплеер</option>
                      <option value="maker">Мейкер</option>
                      <option value="photographer">Фотограф</option>
                      <option value="cosplayer,maker">Косплеер + мейкер</option>
                    </select>
                  </Field>
                  <Field label="Email">
                    <input className="field" value={email} disabled />
                  </Field>
                  <Field label="Телефон">
                    <input className="field" value={phone} onChange={(e) => { setPhone(e.target.value); mark(); }} />
                  </Field>
                  <Field label={`Bio ${bio.length}/500`}>
                    <textarea className="field-box" maxLength={500} rows={4} value={bio} onChange={(e) => { setBio(e.target.value); mark(); }} />
                  </Field>
                  <Field label="Город">
                    <input className="field" value={city} onChange={(e) => { setCity(e.target.value); mark(); }} />
                  </Field>
                  <Field label="Дата рождения (не публичная)">
                    <input type="date" className="field" value={dob} onChange={(e) => { setDob(e.target.value); mark(); }} />
                    <label className="flex items-center gap-2 mt-2 text-[13px]">
                      <input type="checkbox" checked={showAge} onChange={(e) => { setShowAge(e.target.checked); mark(); }} />
                      Показывать возраст
                    </label>
                  </Field>
                  <Field label="Языки">
                    <input className="field" value={langs} onChange={(e) => { setLangs(e.target.value); mark(); }} />
                  </Field>
                  <Field label="Специализации / навыки">
                    <input className="field" value={specs} onChange={(e) => { setSpecs(e.target.value); mark(); }} placeholder="крой, wig styling" />
                  </Field>
                  <Field label="Опыт (лет)">
                    <input className="field" type="number" min={0} value={expYears} onChange={(e) => { setExpYears(e.target.value); mark(); }} />
                  </Field>
                  <Field label="Материалы">
                    <input className="field" value={materials} onChange={(e) => { setMaterials(e.target.value); mark(); }} placeholder="EVA, термопластик" />
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
                    <input className="field" value={commTypes} onChange={(e) => { setCommTypes(e.target.value); mark(); }} placeholder="Костюмы, корсеты" />
                  </Field>
                  <Field label="Типичный срок">
                    <input className="field" value={commDuration} onChange={(e) => { setCommDuration(e.target.value); mark(); }} placeholder="3–6 недель" />
                  </Field>
                  <Field label="Макс. заказов">
                    <div className="flex items-center gap-3">
                      <Button variant="outline" size="sm" onClick={() => { setMaxOrders(Math.max(1, maxOrders - 1)); mark(); }}>−</Button>
                      <span className="font-mono">{maxOrders}</span>
                      <Button variant="outline" size="sm" onClick={() => { setMaxOrders(maxOrders + 1); mark(); }}>+</Button>
                    </div>
                  </Field>
                  <div className="flex gap-2">
                    <Button disabled={!dirty} onClick={save}>Сохранить</Button>
                    <Button variant="outline" onClick={() => window.location.reload()}>Сброс</Button>
                  </div>
                </div>
              </>
            )}

            {settingsTab === "portfolio" && !isClient && (
              <div>
                <p className="text-ink-70 mb-4">Те же работы, что на публичном профиле.</p>
                <Button href={`/profile/${username || nick}`}>Открыть портфолио работ</Button>
              </div>
            )}

            {settingsTab === "socials" && (
              <div className="flex flex-col gap-3 max-w-[520px]">
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
                <Button disabled={!dirty} onClick={save}>Сохранить</Button>
              </div>
            )}

            {settingsTab === "security" && (
              <form
                className="flex flex-col gap-4 max-w-[420px]"
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
              <div className="flex flex-col gap-3 max-w-[420px]">
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

          <aside className="flex flex-col gap-4">
            <Frame className="p-4 bg-stage">
              <div className="font-mono text-[11px] text-ink-45 mb-2">Статус аккаунта · {complete.percent}%</div>
              <div className="h-1.5 bg-ink mb-2"><div className="h-full bg-magenta" style={{ width: `${complete.percent}%` }} /></div>
              <ul className="text-[12px] text-ink-70 space-y-1">
                <li>{complete.checks?.avatar ? "Аватар есть" : "Добавьте аватар"}</li>
                <li>{complete.checks?.bio ? "Bio заполнено" : "Напишите bio"}</li>
                <li>{complete.checks?.city ? "Город указан" : "Укажите город"}</li>
                {!isClient && (
                  <li>{complete.checks?.portfolio ? "Есть работы" : "Добавьте работу"}</li>
                )}
              </ul>
            </Frame>
            <Frame className="p-4 bg-stage">
              <div className="font-mono text-[11px] text-ink-45">Баланс</div>
              <div className="font-mono text-[18px] mt-1">{formatSum(balance)}</div>
              <Button size="sm" className="mt-3 w-full" disabled={!PAYMENTS_LIVE} onClick={() => PAYMENTS_LIVE && setWithdrawOpen(true)}>Вывести</Button>
              {!PAYMENTS_LIVE && <p className="font-mono text-[10px] text-amber mt-2">На бета-тестировании</p>}
            </Frame>
            <Frame className="p-4 bg-stage">
              <div className="font-mono text-[11px] text-ink-45 mb-2">Активность 30 дней</div>
              <div className="flex items-end gap-1 h-16">
                {(activity.length ? activity : Array(10).fill(0)).map((h, i) => (
                  <div key={i} className="flex-1 bg-magenta/70" style={{ height: `${(h / maxBar) * 100}%` }} />
                ))}
              </div>
            </Frame>
            <div className="flex flex-col gap-2">
              <Button variant="outline" size="sm" href={`/profile/${username || nick}`}>Портфолио</Button>
              <Button variant="outline" size="sm" onClick={() => setPrivacyOpen(true)}>Приватность</Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
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
              >
                Скачать данные
              </Button>
              <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>Удалить аккаунт</Button>
            </div>
          </aside>
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
