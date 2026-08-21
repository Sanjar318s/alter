import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Правила площадки для косплееров",
  description:
    "Правила использования AlterCosPlay: заказы на костюмы косплей, коммишены, контент, сообщество и безопасность.",
  path: "/rules",
});

export default function RulesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
