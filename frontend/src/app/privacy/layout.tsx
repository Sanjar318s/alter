import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Политика конфиденциальности",
  description:
    "Как платформа ALTER обрабатывает персональные данные косплееров, мастеров и заказчиков костюмов косплей.",
  path: "/privacy",
});

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
