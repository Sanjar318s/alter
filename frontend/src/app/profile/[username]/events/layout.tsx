import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username: raw } = await params;
  const username = decodeURIComponent(raw);

  return pageMetadata({
    title: `События и выступления @${username}`,
    description: `Календарь косплей-событий мастера @${username}: фестивали, конвенты и встречи сообщества на платформе ALTER.`,
    path: `/profile/${username}/events`,
  });
}

export default function ProfileEventsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
