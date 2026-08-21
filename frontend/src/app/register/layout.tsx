import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Регистрация — создать профиль косплеера",
  description:
    "Создайте профиль на AlterCosPlay: портфолио, коммишены и приём заказов на костюмы косплей.",
  path: "/register",
  noIndex: true,
});

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
