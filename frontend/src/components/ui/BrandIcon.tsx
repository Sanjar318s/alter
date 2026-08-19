import {
  siDiscord,
  siInstagram,
  siPatreon,
  siTelegram,
  siTiktok,
  siVk,
  siX,
  siYoutube,
} from "simple-icons";
import { cn } from "@/lib/cn";

type Brand = { title: string; path: string };

const BRANDS: Record<string, Brand> = {
  instagram: siInstagram,
  tiktok: siTiktok,
  youtube: siYoutube,
  telegram: siTelegram,
  x: siX,
  twitter: siX,
  patreon: siPatreon,
  discord: siDiscord,
  vk: siVk,
};

export function BrandIcon({
  name,
  className,
  size = 16,
}: {
  name: string;
  className?: string;
  size?: number;
}) {
  const icon = BRANDS[name.toLowerCase()];
  if (!icon) return null;
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn("fill-current", className)}
      aria-hidden
    >
      <title>{icon.title}</title>
      <path d={icon.path} />
    </svg>
  );
}
