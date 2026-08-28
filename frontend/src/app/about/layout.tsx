import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "О платформе — биржа готовых работ и рилсы",
  description:
    "AlterCosPlay — биржа готовых работ косплея, рилсы о процессе и контенте, заказы у продавцов в одном профиле.",
  path: "/about",
});

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
