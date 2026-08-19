import { cn } from "@/lib/cn";

type StepperProps = {
  steps: string[];
  current: number;
};

export function Stepper({ steps, current }: StepperProps) {
  return (
    <ol className="flex flex-col gap-2 mb-6 list-none">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li key={label} className="flex items-center gap-2.5">
            <span
              className={cn(
                "w-5 h-5 shrink-0 flex items-center justify-center font-mono text-[10px]",
                active && "bg-magenta text-paper",
                done && "bg-magenta/60 text-paper",
                !active && !done && "border border-line text-ink-45"
              )}
            >
              {done ? "✓" : n}
            </span>
            <span
              className={cn(
                "font-mono text-[11px] uppercase tracking-[0.06em]",
                active ? "text-paper" : "text-ink-45"
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
