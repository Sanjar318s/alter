import type { Metadata } from "next";
import { fetchPublicJson, pageMetadata, truncate } from "@/lib/seo";

type ProfileResponse = {
  user: { username: string };
  profile?: { displayName?: string; bio?: string; isPrivate?: boolean };
  isPrivate?: boolean;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username: raw } = await params;
  const username = decodeURIComponent(raw);
  const data = await fetchPublicJson<ProfileResponse>(
    `/api/users/${encodeURIComponent(username)}`
  );

  if (!data) {
    return pageMetadata({
      title: "Профиль не найден",
      description: "Пользователь не найден на платформе ALTER.",
      path: `/profile/${username}`,
      noIndex: true,
    });
  }

  const displayName = data.profile?.displayName || username;
  const bio = data.profile?.bio
    ? truncate(data.profile.bio)
    : `Портфолио ${displayName}: билды косплея, заказать костюм косплей и коммишены на платформе для косплееров ALTER.`;

  return pageMetadata({
    title: `${displayName} (@${username}) — портфолио мастера косплея`,
    description: bio,
    path: `/profile/${username}`,
    noIndex: Boolean(data.isPrivate || data.profile?.isPrivate),
  });
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
