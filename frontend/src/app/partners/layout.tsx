import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Партнёры — магазины, студии и ивенты косплея",
  description:
    "Партнёрская программа ALTER для магазинов тканей, студий и организаторов ивентов. Поддержка сообщества косплееров и мастеров.",
  path: "/partners",
});

export default function PartnersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
