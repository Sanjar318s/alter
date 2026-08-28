import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Биржа — готовые работы косплея",
  description:
    "Готовые работы продавцов и партнёров AlterCosPlay. Смотрите результат, открывайте профиль автора и заказывайте услугу, если она доступна.",
  path: "/market",
});

export default function MarketLayout({ children }: { children: React.ReactNode }) {
  return children;
}
