import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";

type BrandLogoProps = {
  href?: string;
  showText?: boolean;
  size?: number;
  className?: string;
  imageClassName?: string;
  /** Serve the original PNG without Next image compression (hero / large marks). */
  unoptimized?: boolean;
  quality?: number;
};

export function BrandLogo({
  href = "/",
  showText = true,
  size = 36,
  className,
  imageClassName,
  unoptimized = false,
  quality = 90,
}: BrandLogoProps) {
  const inner = (
    <>
      <Image
        src="/logo.png"
        alt="AlterCosPlay"
        width={size}
        height={size}
        quality={quality}
        unoptimized={unoptimized}
        sizes={unoptimized ? undefined : `${size}px`}
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
