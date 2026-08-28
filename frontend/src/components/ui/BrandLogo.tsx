import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";

type BrandLogoProps = {
  href?: string;
  showText?: boolean;
  size?: number;
  className?: string;
  imageClassName?: string;
};

export function BrandLogo({
  href = "/",
  showText = true,
  size = 36,
  className,
  imageClassName,
}: BrandLogoProps) {
  const inner = (
    <>
      <Image
        src="/logo.svg"
        alt="AlterCosPlay"
        width={size}
        height={size}
        className={cn("shrink-0 rounded-full", imageClassName)}
        priority
      />
      {showText && (
        <span className="font-display font-extrabold text-lg tracking-tight">AlterCosPlay</span>
      )}
    </>
  );

  if (!href) {
    return <span className={cn("flex items-center gap-2 text-paper", className)}>{inner}</span>;
  }

  return (
    <Link href={href} className={cn("flex items-center gap-2 text-paper no-underline shrink-0", className)}>
      {inner}
    </Link>
  );
}
