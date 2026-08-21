import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

const variants = {
  primary:
    "bg-gradient-to-r from-magenta to-amber text-paper hover:opacity-90 border-0",
  danger:
    "border border-[#FF426F] text-[#FF426F] bg-transparent hover:bg-[#FF426F]/10",
  outline:
    "border border-line text-paper bg-transparent hover:border-paper",
  ghost: "border-0 bg-transparent text-ink-45 hover:text-paper",
};

const sizes = {
  sm: "px-4 py-2 text-[12px] font-medium",
  md: "px-6 py-3 text-sm font-semibold",
};

type ButtonProps = {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  href?: string;
  children: ReactNode;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  variant = "primary",
  size = "md",
  href,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  const cls = cn(
    "inline-flex items-center justify-center text-center no-underline rounded-[4px] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
    variants[variant],
    sizes[size],
    className
  );

  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} className={cls} {...props}>
      {children}
    </button>
  );
}
