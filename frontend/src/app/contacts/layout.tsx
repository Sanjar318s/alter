import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Контакты — связаться с командой AlterCosPlay",
  description:
    "Свяжитесь с AlterCosPlay: поддержка, партнёрство, вопросы по заказам костюмов и коммишенам.",
  path: "/contacts",
});

export default function ContactsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
