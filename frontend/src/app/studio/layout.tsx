import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Студия — рабочая доска заказов",
  description: "Управление заказами, клиентами и финансами мастера косплея в AlterCosPlay.",
  path: "/studio",
  noIndex: true,
});

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return children;
}
