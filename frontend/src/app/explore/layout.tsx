import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Исследовать — работы, мастера и заказы на косплей",
  description:
    "Новые работы косплея, открытые заказы на костюмы и фриланс мастера косплея. Ищите вдохновение и заказчиков на AlterCosPlay.",
  path: "/explore",
});

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
