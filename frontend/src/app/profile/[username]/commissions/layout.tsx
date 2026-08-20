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
    title: `Заказать костюм косплей — коммишены @${username}`,
    description: `Оформите коммишен у @${username}: заказать костюм косплей, обсудить сроки и бюджет с фриланс мастером косплея на ALTER.`,
    path: `/profile/${username}/commissions`,
  });
}

export default function ProfileCommissionsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
