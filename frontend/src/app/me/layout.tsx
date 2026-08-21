import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Мой профиль",
  description: "Личный кабинет на AlterCosPlay.",
  path: "/me",
  noIndex: true,
});

export default function MeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
