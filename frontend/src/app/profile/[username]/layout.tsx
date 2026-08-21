import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  fetchPublicJson,
  pageMetadata,
  personJsonLd,
  SITE_NAME,
  truncate,
} from "@/lib/seo";

type ProfileResponse = {
  user: { username: string };
  profile?: {
    displayName?: string;
    bio?: string;
    avatarUrl?: string | null;
    isPrivate?: boolean;
  };
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
      description: `Пользователь не найден на платформе ${SITE_NAME}.`,
      path: `/profile/${username}`,
      noIndex: true,
    });
  }

  const displayName = data.profile?.displayName || username;
  const bio = data.profile?.bio
    ? truncate(data.profile.bio)
    : `Портфолио ${displayName}: работы косплея, заказать костюм и крафт на ${SITE_NAME}.`;

  return pageMetadata({
    title: `Косплеер ${displayName} — Заказать костюм и крафт | ${SITE_NAME}`,
    description: bio,
    path: `/profile/${username}`,
    absoluteTitle: true,
    noIndex: Boolean(data.isPrivate || data.profile?.isPrivate),
    image: data.profile?.avatarUrl || undefined,
  });
}

export default async function ProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ username: string }>;
}) {
  const { username: raw } = await params;
  const username = decodeURIComponent(raw);
  const data = await fetchPublicJson<ProfileResponse>(
    `/api/users/${encodeURIComponent(username)}`
  );

  const isPrivate = Boolean(data?.isPrivate || data?.profile?.isPrivate);
  const displayName = data?.profile?.displayName || username;
  const jsonLd =
    data && !isPrivate
      ? personJsonLd({
          name: displayName,
          username,
          description: data.profile?.bio ? truncate(data.profile.bio, 200) : undefined,
          image: data.profile?.avatarUrl,
        })
      : null;

  return (
    <>
      {jsonLd ? <JsonLd data={jsonLd} /> : null}
      {children}
    </>
  );
}
