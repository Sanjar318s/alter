import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Каталог работ — биржа косплея",
  description:
    "Поиск готовых работ косплея на AlterCosPlay: персонажи, франшизы, профили продавцов и заказ услуги, если автор её предлагает.",
  path: "/explore",
});

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
