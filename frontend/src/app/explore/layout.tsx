import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ALTER — Исследовать",
  description: "Новые билды, открытые заказы и комьюнити косплея.",
};

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
