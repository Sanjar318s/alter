import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Контакты — связаться с командой ALTER",
  description:
    "Свяжитесь с платформой для косплееров ALTER: поддержка, партнёрство, вопросы по заказам костюмов и коммишенам.",
  path: "/contacts",
});

export default function ContactsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
