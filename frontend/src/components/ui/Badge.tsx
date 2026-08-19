import { cn } from "@/lib/cn";

const STATUS = {
  open: {
    label: "Открыто",
    hint: "Берёт заказы — можно отправить заявку",
    className:
      "bg-gradient-to-r from-magenta to-[#ff7aa3] text-paper shadow-[0_0_14px_rgba(229,72,122,0.45)] ring-1 ring-white/15",
    dot: "bg-paper",
  },
  closed: {
    label: "Закрыто",
    hint: "Сейчас заказы не принимает",
    className: "bg-stage text-ink-45 ring-1 ring-line",
    dot: "bg-ink-45",
  },
  waitlist: {
    label: "Лист ожидания",
    hint: "Можно встать в очередь, пока слоты закрыты",
    className:
      "bg-gradient-to-r from-amber to-[#ffc56b] text-ink shadow-[0_0_12px_rgba(242,169,59,0.35)] ring-1 ring-amber/40",
    dot: "bg-ink",
  },
} as const;

type BadgeProps = {
  status?: keyof typeof STATUS;
  children?: string;
  hint?: string;
  className?: string;
};

export function Badge({
  status = "open",
  children,
  hint,
  className,
}: BadgeProps) {
  const meta = STATUS[status];
  const title = hint ?? meta.hint;

  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-[4px] font-semibold",
        meta.className,
        className
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", meta.dot, status === "open" && "animate-pulse")} />
      {children ?? meta.label}
    </span>
  );
}
