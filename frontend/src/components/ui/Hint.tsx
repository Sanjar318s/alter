"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

type HintProps = {
  term: string;
  text: string;
  className?: string;
};

export function Hint({ term, text, className }: HintProps) {
  const [open, setOpen] = useState(false);

  return (
    <span className={cn("relative inline-flex items-baseline", className)}>
      <button
        type="button"
        className="border-0 bg-transparent p-0 font-inherit text-inherit cursor-help border-b border-dotted border-ink-45"
        aria-describedby={open ? `hint-${term}` : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
      >
        {term}
      </button>
      {open && (
        <span
          id={`hint-${term}`}
          role="tooltip"
          className="absolute left-0 top-full z-30 mt-1.5 w-max max-w-[240px] bg-stage-elevated border border-line px-3 py-2 text-[12px] text-ink-70 leading-snug shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
}
