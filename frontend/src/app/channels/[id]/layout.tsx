import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  return pageMetadata({
    title: "Канал сообщества",
    description: "Канал косплей-сообщества на платформе ALTER.",
    path: `/channels/${id}`,
    noIndex: true,
  });
}

export default function ChannelLayout({ children }: { children: React.ReactNode }) {
  return children;
}
