import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  fetchPublicJson,
  pageMetadata,
  serviceJsonLd,
  SITE_NAME,
  SITE_URL,
} from "@/lib/seo";

type ProfileResponse = {
  user: { username: string };
  profile?: { displayName?: string; bio?: string };
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username: raw } = await params;
  const username = decodeURIComponent(raw);

  return pageMetadata({
    title: `Заказать костюм косплей — коммишены @${username}`,
    description: `Оформите коммишен у @${username}: заказать костюм косплей, обсудить сроки и бюджет с фриланс мастером косплея на ${SITE_NAME}.`,
    path: `/profile/${username}/commissions`,
  });
}

export default async function ProfileCommissionsLayout({
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
  const displayName = data?.profile?.displayName || username;
  const profileUrl = `${SITE_URL}/profile/${encodeURIComponent(username)}`;

  return (
    <>
      <JsonLd
        data={serviceJsonLd({
          name: `Коммишены — ${displayName}`,
          description: `Заказать костюм косплей и крафт у ${displayName} (@${username}) на ${SITE_NAME}.`,
          url: `${profileUrl}/commissions`,
          providerName: displayName,
          providerUrl: profileUrl,
        })}
      />
      {children}
    </>
  );
}
