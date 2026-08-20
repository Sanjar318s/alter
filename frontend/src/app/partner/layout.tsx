import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Партнёрский кабинет",
  description: "Управление партнёрским профилем на платформе ALTER.",
  path: "/partner",
  noIndex: true,
});

export default function PartnerPortalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
