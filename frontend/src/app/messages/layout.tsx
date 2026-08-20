import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Сообщения",
  description: "Переписка на платформе ALTER.",
  path: "/messages",
  noIndex: true,
});

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
