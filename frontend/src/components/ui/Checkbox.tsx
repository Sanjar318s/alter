"use client";

import { Check } from "lucide-react";
import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export function Checkbox({ className, disabled, ...props }: CheckboxProps) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <input
        type="checkbox"
        disabled={disabled}
        className="peer sr-only"
        {...props}
      />
      <span
        aria-hidden
        className={cn(
          "flex items-center justify-center w-[18px] h-[18px] rounded-[4px]",
          "border border-line bg-ink transition-all duration-200",
          "peer-hover:border-ink-45 peer-hover:bg-ink/80",
          "peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-magenta/45 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-stage",
          "peer-checked:border-magenta peer-checked:bg-gradient-to-br peer-checked:from-magenta peer-checked:to-[#c9347a]",
          "peer-checked:shadow-[0_0_14px_rgba(255,66,111,0.4)]",
          "peer-checked:[&_svg]:opacity-100 peer-checked:[&_svg]:scale-100",
          "peer-disabled:opacity-40 peer-disabled:cursor-not-allowed",
          disabled && "opacity-40 cursor-not-allowed"
        )}
      >
        <Check
          size={12}
          strokeWidth={3}
          className="text-paper opacity-0 scale-75 transition-all duration-200 pointer-events-none"
        />
      </span>
    </span>
  );
}
