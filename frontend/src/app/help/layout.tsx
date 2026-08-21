import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Центр помощи — как пользоваться AlterCosPlay",
  description:
    "Ответы по регистрации, портфолио, коммишенам и заказам костюмов косплей. Помощь для косплееров и фриланс мастеров косплея на AlterCosPlay.",
  path: "/help",
});

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
