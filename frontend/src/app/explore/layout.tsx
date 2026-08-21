import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Исследовать — билды, мастера и заказы на косплей",
  description:
    "Новые билды косплея, открытые заказы на костюмы и фриланс мастера косплея. Ищите вдохновение и заказчиков на AlterCosPlay.",
  path: "/explore",
});

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
