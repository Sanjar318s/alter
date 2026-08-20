import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "О платформе — профиль, заказы и комьюнити косплееров",
  description:
    "ALTER — платформа для косплееров, мейкеров и фотографов: портфолио костюмов, коммишены, заказать костюм косплей и работа с клиентами в одном месте.",
  path: "/about",
});

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
