"use client";

import Link from "next/link";
import {
  Check,
  ChevronRight,
  ClipboardList,
  Compass,
  FileText,
  LayoutDashboard,
  MapPin,
  MessagesSquare,
  Plus,
  ScanLine,
  User,
  X,
} from "lucide-react";
import { Frame } from "@/components/Frame";
import { Button } from "@/components/ui/Button";
import { FilmStill } from "@/components/ui/FilmStill";
import { PartnerAdSlot } from "@/components/marketing/PartnerAdSlot";
import { useLocale } from "@/lib/LocaleContext";

const SHELL = "max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-10";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <Glossary />

      <section className="border-b border-line py-12 lg:py-16">
        <div className={SHELL}>
          <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-10 xl:gap-12 items-start">
            <HowItWorks />
            <Demo />
          </div>
        </div>
      </section>

      <section className="border-b border-line py-12 lg:py-16">
        <div className={SHELL}>
          <Comparison />
        </div>
      </section>

      <PartnerAdSlot />

      <Roles />
    </>
  );
}

/* ------------------------------------------------------------------ hero */

function Hero() {
  const { t } = useLocale();
  const shots = [
    { seed: "jinx", name: "JINX", franchise: "LEAGUE OF LEGENDS" },
    { seed: "raiden", name: "RAIDEN", franchise: "GENSHIN IMPACT" },
    { seed: "miku", name: "MIKU", franchise: "VOCALOID" },
  ];

  return (
    <section className="hero-wash border-b border-line py-12 md:py-16 lg:py-20">
      <div className={SHELL}>
        <div className="relative z-[1] grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-10 lg:gap-12 items-center">
          <div>
            <span className="font-mono text-[11px] sm:text-[12px] uppercase tracking-[0.18em] text-magenta">
              {t("heroEyebrow")}
            </span>
            <h1 className="font-display font-extrabold text-[clamp(30px,4.2vw,52px)] leading-[1.08] mt-5">
              {t("heroTitle")}
            </h1>
            <p className="text-[15px] md:text-[16px] text-ink-70 mt-6 leading-relaxed max-w-[440px]">
              {t("heroLead")}
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Button href="/register">{t("createProfile")}</Button>
              <Button href="/explore" variant="outline">
                {t("watchHow")}
              </Button>
            </div>
          </div>

          <div className="flex flex-col xl:flex-row gap-5 xl:gap-6 items-stretch xl:items-start">
            <Frame className="flex-1 p-4 sm:p-5 bg-stage/70 backdrop-blur-sm border border-line/70">
              <div className="flex items-center gap-4">
                <FilmStill
                  seed="nyx.cosplay"
                  alt="nyx.cosplay"
                  framed
                  className="w-[76px] h-[92px] sm:w-[88px] sm:h-[106px] shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-display font-extrabold text-[22px] sm:text-[26px] leading-tight truncate">
                    nyx.cosplay
                  </div>
                  <div className="font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.14em] text-ink-70 mt-1.5">
                    Косплеер · Мейкер
                  </div>
                  <div className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-45 mt-2">
                    <MapPin size={11} strokeWidth={2} />
                    Москва, Россия
                  </div>
                </div>
                <span className="self-start shrink-0 font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.12em] text-magenta border border-magenta px-2.5 py-1.5">
                  {t("openStatus")}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2.5 sm:gap-3 mt-5">
                {shots.map((shot) => (
                  <div key={shot.seed}>
                    <FilmStill
                      seed={shot.seed}
                      alt={shot.name}
                      framed
                      hover
                      className="aspect-[4/5]"
                    />
                    <div className="font-display font-extrabold text-[11px] sm:text-[13px] mt-2.5 truncate">
                      {shot.name}
                    </div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-45 mt-1 truncate">
                      {shot.franchise}
                    </div>
                  </div>
                ))}
              </div>
            </Frame>

            <div className="flex flex-row xl:flex-col gap-3 xl:w-[186px] shrink-0">
              <Note tone="magenta" className="xl:rotate-[-2.5deg]">
                {t("noteOrders")}
              </Note>
              <Note tone="amber" className="xl:rotate-[2deg] xl:mt-4">
                {t("notePortfolio")}
              </Note>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Note({
  tone,
  className,
  children,
}: {
  tone: "magenta" | "amber";
  className?: string;
  children: string;
}) {
  const color =
    tone === "amber"
      ? "border-amber/70 text-amber bg-amber/[0.06]"
      : "border-magenta/70 text-magenta bg-magenta/[0.06]";

  return (
    <div
      className={`flex-1 border px-3.5 py-3 font-mono text-[11px] leading-[1.5] ${color} ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------- glossary */

const GLOSSARY = [
  {
    icon: ScanLine,
    term: "Билд",
    text: "Каждый костюм — это билд. Фотографии, процесс, материалы и результат.",
  },
  {
    icon: ClipboardList,
    term: "Коммишен",
    text: "Прозрачные заказы: заявка, дедлайны, оплаты и статус — всё на виду.",
  },
  {
    icon: LayoutDashboard,
    term: "Maker Studio",
    text: "Рабочее пространство мейкера: доска заказов, календарь и финансы.",
  },
  {
    icon: MessagesSquare,
    term: "Каналы",
    text: "Личные диалоги и тематические каналы: команда, клиенты, мероприятия.",
  },
];

function Glossary() {
  const { t } = useLocale();
  const items = [
    { icon: ScanLine, term: t("buildTerm"), text: t("glossaryBuild") },
    { icon: ClipboardList, term: t("glossaryCommission"), text: t("glossaryCommissionText") },
    { icon: LayoutDashboard, term: "Maker Studio", text: t("glossaryStudio") },
    { icon: MessagesSquare, term: t("glossaryChannels"), text: t("glossaryChannelsText") },
  ];
  return (
    <section className="border-b border-line py-10 lg:py-12">
      <div className={SHELL}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item, i) => (
            <div
              key={item.term}
              className={[
                "flex gap-3.5 py-5 sm:py-5 lg:py-1",
                i > 0 && "border-t border-line sm:border-t-0",
                i >= 2 && "sm:border-t sm:border-line lg:border-t-0",
                i % 2 === 1 && "sm:border-l sm:border-line sm:pl-6",
                i > 0 && "lg:border-l lg:border-line lg:pl-6",
                i < 3 && "lg:pr-6",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="w-9 h-9 shrink-0 border border-magenta/60 flex items-center justify-center text-magenta">
                <item.icon size={16} strokeWidth={1.75} />
              </span>
              <div className="min-w-0">
                <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-magenta">
                  {item.term}
                </div>
                <p className="text-[13px] text-ink-70 mt-2 leading-relaxed">
                  {item.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- how it works */

const STEPS = [
  {
    n: "01",
    icon: User,
    title: "Профиль",
    text: "Создайте профиль и покажите свои билды.",
    href: "/profile/nyx.cosplay",
  },
  {
    n: "02",
    icon: Compass,
    title: "Исследовать",
    text: "Находите мейкеров, открытые заказы и людей.",
    href: "/explore",
  },
  {
    n: "03",
    icon: FileText,
    title: "Заявка",
    text: "Отправьте заявку с референсами и замерами.",
    href: "/profile/nyx.cosplay/commissions",
  },
  {
    n: "04",
    icon: MessagesSquare,
    title: "Студия и чат",
    text: "Работайте в студии, общайтесь и следите за прогрессом.",
    href: "/studio",
  },
];

function HowItWorks() {
  const { t } = useLocale();
  const steps = [
    { n: "01", icon: User, title: t("stepProfile"), text: t("stepProfileText"), href: "/profile/nyx.cosplay" },
    { n: "02", icon: Compass, title: t("stepExplore"), text: t("stepExploreText"), href: "/explore" },
    { n: "03", icon: FileText, title: t("stepRequest"), text: t("stepRequestText"), href: "/profile/nyx.cosplay/commissions" },
    { n: "04", icon: MessagesSquare, title: t("stepStudio"), text: t("stepStudioText"), href: "/studio" },
  ];
  return (
    <div>
      <SectionLabel>{t("howItWorks")}</SectionLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
        {steps.map((step, i) => (
          <div key={step.n} className="relative">
            <Link href={step.href} className="no-underline text-paper group block h-full">
              <Frame hollow hover className="p-4 h-full flex flex-col">
                <div className="font-mono text-[13px] text-magenta">{step.n}</div>
                <span className="mt-4 mb-3 text-magenta">
                  <step.icon size={20} strokeWidth={1.5} />
                </span>
                <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] group-hover:text-magenta transition-colors">
                  {step.title}
                </h3>
                <p className="text-[13px] text-ink-70 mt-2 leading-relaxed">
                  {step.text}
                </p>
              </Frame>
            </Link>
            {i % 2 === 0 && (
              <ChevronRight
                size={16}
                strokeWidth={2}
                aria-hidden
                className="hidden sm:block absolute top-1/2 -right-2.5 -translate-y-1/2 text-magenta/70"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ comparison */

const NOW = [
  {
    label: "Instagram",
    detail: "Режет охваты, банит за косплей",
  },
  {
    label: "Patreon / Ko-fi",
    detail: "Донаты отдельно от портфолио",
  },
  {
    label: "Etsy / переписка",
    detail: "Заказы без учёта и статусов",
  },
  {
    label: "Google Sheets",
    detail: "Замеры и дедлайны вручную",
  },
  {
    label: "Discord",
    detail: "Общение оторвано от профиля",
  },
  {
    label: "Авторство фото",
    detail: "Согласие и теги — на словах",
  },
];

const ALTER = [
  {
    label: "Один профиль",
    detail: "Портфолио, истории и все ссылки",
  },
  {
    label: "Статус коммишена",
    detail: "Виден сразу — без лишней переписки",
  },
  {
    label: "Maker Studio",
    detail: "Заказы, депозиты и дедлайны",
  },
  {
    label: "Заявка по шаблону",
    detail: "Референсы, замеры и срок — по шагам",
  },
  {
    label: "Чат рядом с заказом",
    detail: "Каналы по франшизе и конвенту",
  },
  {
    label: "Тег автора",
    detail: "Согласие на публикацию на каждом фото",
  },
];

function Comparison() {
  const { t } = useLocale();
  const pairs = NOW.map((now, i) => ({ now, alter: ALTER[i], n: String(i + 1).padStart(2, "0") }));

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-8 mb-6 lg:mb-8">
        <SectionLabel>{t("comparison")}</SectionLabel>
        <p className="text-[13px] text-ink-70 leading-relaxed max-w-[460px] sm:text-right">
          {t("comparisonLead")}
        </p>
      </div>

      <Frame className="relative bg-ink/40 border border-line overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none hidden md:block absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,transparent_48%,rgba(229,72,122,0.08)_50%,transparent_52%,transparent_100%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none hidden md:block absolute right-0 inset-y-0 w-[52%] bg-gradient-to-br from-magenta/[0.1] via-transparent to-amber/[0.05]"
        />

        <div className="relative grid grid-cols-1 md:grid-cols-[1fr_72px_1fr]">
          <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-line bg-stage/50">
            <div>
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-45">
                {t("now")}
              </span>
              <p className="text-[12px] text-ink-45 mt-1">{t("nowSub")}</p>
            </div>
            <span className="w-8 h-8 shrink-0 border border-line/80 flex items-center justify-center text-ink-45">
              <X size={14} strokeWidth={2.5} />
            </span>
          </div>

          <div className="hidden md:flex items-center justify-center border-b border-line relative">
            <span aria-hidden className="absolute inset-y-0 w-px bg-magenta/35" />
            <span className="relative z-[1] font-mono text-[10px] uppercase tracking-[0.22em] text-magenta border border-magenta bg-ink px-2 py-1 -rotate-6 shadow-[0_0_18px_rgba(229,72,122,0.35)]">
              VS
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-magenta/25 bg-magenta/[0.07]">
            <div>
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-magenta">
                ALTER
              </span>
              <p className="text-[12px] text-paper/85 mt-1">{t("alterSub")}</p>
            </div>
            <span className="w-8 h-8 shrink-0 border border-magenta/70 bg-magenta/15 flex items-center justify-center text-magenta">
              <Check size={14} strokeWidth={2.5} />
            </span>
          </div>

          {pairs.map((row, i) => (
            <div key={row.n} className="contents">
              <div
                className={`flex gap-3 items-start px-4 sm:px-6 py-4 md:py-5 ${
                  i < pairs.length - 1 ? "border-b border-line/60" : ""
                }`}
              >
                <span className="font-mono text-[10px] text-ink-45/70 mt-1 w-5 shrink-0">
                  {row.n}
                </span>
                <X
                  size={13}
                  strokeWidth={2.5}
                  className="text-ink-45 shrink-0 mt-1"
                  aria-hidden
                />
                <div className="min-w-0">
                  <div className="text-[13px] text-ink-45 font-medium">{row.now.label}</div>
                  <div className="text-[12px] text-ink-45/75 mt-0.5 leading-snug">
                    {row.now.detail}
                  </div>
                </div>
              </div>

              <div
                className={`hidden md:flex items-center justify-center ${
                  i < pairs.length - 1 ? "border-b border-line/60" : ""
                }`}
              >
                <ChevronRight size={14} strokeWidth={1.75} className="text-magenta/55" aria-hidden />
              </div>

              <div
                className={`flex gap-3 items-start px-4 sm:px-6 py-4 md:py-5 ${
                  i < pairs.length - 1 ? "border-b border-magenta/15 md:border-line/60" : ""
                }`}
              >
                <span className="md:hidden font-mono text-[10px] uppercase tracking-[0.16em] text-magenta mt-1 shrink-0">
                  →
                </span>
                <span className="w-[18px] h-[18px] shrink-0 mt-0.5 border border-magenta/50 bg-magenta/10 flex items-center justify-center">
                  <Check size={11} strokeWidth={2.75} className="text-magenta" aria-hidden />
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] text-paper font-medium">{row.alter.label}</div>
                  <div className="text-[12px] text-ink-70 mt-0.5 leading-snug">
                    {row.alter.detail}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Frame>
    </div>
  );
}

/* ------------------------------------------------------------------ demo */

const BOARD = [
  {
    col: "Обсуждение",
    cards: [
      { user: "maya.rin", char: "Jinx", date: "10.05" },
      { user: "ghost.k", char: "Alledo", date: "20.05" },
    ],
  },
  {
    col: "В работе",
    cards: [
      { user: "luna.s", char: "Raiden", date: "15.05" },
      { user: "keiichi", char: "Zero", date: "12.05" },
    ],
  },
  {
    col: "Примерка",
    cards: [
      { user: "v3ka.g", char: "Miku", date: "08.05" },
      { user: "dove.cat", char: "Reyy", date: "18.05" },
    ],
  },
  {
    col: "Готово",
    cards: [
      { user: "hoa.photo", char: "2B", date: "03.06" },
      { user: "akio.cos", char: "GoJo", date: "30.04" },
    ],
  },
];

function Demo() {
  const { t } = useLocale();
  return (
    <div>
      <SectionLabel>{t("demo")}</SectionLabel>
      <div className="grid grid-cols-1 sm:grid-cols-[0.68fr_1.32fr] gap-4 mt-5">
        <div className="flex flex-col">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-45 mb-2">
            {t("demoHub")}
          </div>
          <Frame className="p-3.5 bg-stage/50 flex-1 border border-line">
            <div className="flex items-center gap-2.5">
              <FilmStill
                seed="nyx.cosplay"
                framed
                muted
                className="w-11 h-11 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="font-display font-extrabold text-[14px] truncate">
                  nyx.cosplay
                </div>
                <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-45 mt-1">
                  Косплеер · Мейкер
                </div>
              </div>
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-magenta border border-magenta px-2 py-1">
                Открыто
              </span>
            </div>

            <div className="flex gap-3 border-b border-line mt-3">
              {["Билды", "Истории", "О себе"].map((tab, i) => (
                <span
                  key={tab}
                  className={`font-mono text-[10px] uppercase tracking-[0.08em] pb-2 border-b-2 -mb-px ${
                    i === 0 ? "text-paper border-magenta" : "text-ink-45 border-transparent"
                  }`}
                >
                  {tab}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-1.5 mt-3">
              {["jinx", "raiden", "miku", "furina", "yumeko", "zero"].map((seed) => (
                <FilmStill key={seed} seed={seed} className="aspect-[4/5]" />
              ))}
            </div>
          </Frame>
        </div>

        <div className="flex flex-col">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-45 mb-2">
            {t("demoBoard")}
          </div>
          <Frame amber className="p-3.5 bg-stage/50 flex-1 border border-line">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 min-w-0">
              {BOARD.map((column) => (
                <div key={column.col} className="flex flex-col gap-1.5 min-w-0">
                  <div className="font-mono text-[10px] uppercase text-ink-45 pb-1.5 border-b border-line">
                    {column.col}
                  </div>
                  {column.cards.map((card) => (
                    <div
                      key={card.user}
                      className="border border-line bg-ink/60 p-1.5 min-w-0"
                    >
                      <FilmStill seed={card.user} className="aspect-[5/4] w-full" />
                      <div className="font-mono text-[10px] text-ink-45 mt-1.5 truncate">
                        {card.user}
                      </div>
                      <div className="font-display font-bold text-[12px] truncate mt-0.5">
                        {card.char}
                      </div>
                      <div className="font-mono text-[10px] text-magenta mt-0.5">
                        {card.date}
                      </div>
                    </div>
                  ))}
                  <div className="border border-dashed border-line/70 text-ink-45 flex items-center justify-center py-1.5">
                    <Plus size={11} strokeWidth={2} />
                  </div>
                </div>
              ))}
            </div>
          </Frame>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- roles */

const ROLES = [
  {
    role: "Косплеер",
    seed: "cosplayer-role",
    text: "Показывайте свои билды, получайте заказы и находите единомышленников.",
    cta: "Создать профиль",
    href: "/register",
    amber: false,
  },
  {
    role: "Мейкер",
    seed: "maker-role",
    text: "Управляйте заказами, сроками и оплатами в своей студии.",
    cta: "Открыть студию",
    href: "/studio",
    amber: true,
  },
  {
    role: "Фотограф",
    seed: "photo-role",
    text: "Ищите проекты, показывайте портфолио и общайтесь с командой.",
    cta: "Присоединиться",
    href: "/explore",
    amber: false,
  },
];

function Roles() {
  const { t } = useLocale();
  const roles = [
    { role: t("roleCosplayer"), seed: "cosplayer-role", text: t("roleCosplayerText"), cta: t("createProfile"), href: "/register", amber: false },
    { role: t("roleMaker"), seed: "maker-role", text: t("roleMakerText"), cta: t("openStudio"), href: "/studio", amber: true },
    { role: t("rolePhoto"), seed: "photo-role", text: t("rolePhotoText"), cta: t("join"), href: "/explore", amber: false },
  ];
  return (
    <section className="py-12 lg:py-16">
      <div className={SHELL}>
        <SectionLabel>{t("forWhom")}</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
          {roles.map((item) => (
            <Link key={item.role} href={item.href} className="no-underline text-paper group">
              <Frame
                amber={item.amber}
                hover
                className={`flex h-full bg-stage/50 border ${
                  item.amber ? "border-amber/50" : "border-magenta/50"
                }`}
              >
                <FilmStill
                  seed={item.seed}
                  alt={item.role}
                  className="w-[34%] shrink-0 self-stretch min-h-[132px]"
                />
                <div className="p-4 md:p-5 flex flex-col min-w-0 flex-1">
                  <div
                    className={`font-mono text-[11px] uppercase tracking-[0.14em] ${
                      item.amber ? "text-amber" : "text-magenta"
                    }`}
                  >
                    {item.role}
                  </div>
                  <p className="text-[13px] text-ink-70 mt-2.5 leading-relaxed flex-1">
                    {item.text}
                  </p>
                  <span
                    className={`font-mono text-[10px] uppercase tracking-[0.12em] mt-3 underline underline-offset-4 decoration-line group-hover:decoration-current ${
                      item.amber ? "text-amber" : "text-magenta"
                    }`}
                  >
                    {item.cta}
                  </span>
                </div>
              </Frame>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- atoms */

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-2.5 h-2.5 border-t border-l border-magenta shrink-0" />
      <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-magenta">
        {children}
      </span>
    </div>
  );
}
