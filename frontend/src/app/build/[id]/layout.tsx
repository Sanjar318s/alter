import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  creativeWorkJsonLd,
  fetchPublicJson,
  pageMetadata,
  SITE_NAME,
  SITE_URL,
  truncate,
} from "@/lib/seo";

type BuildResponse = {
  build?: {
    title?: string;
    character?: string;
    franchise?: string;
    description?: string;
    coverImageUrl?: string | null;
    updatedAt?: string | null;
  };
  author?: { username?: string; displayName?: string };
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await fetchPublicJson<BuildResponse>(`/api/builds/${encodeURIComponent(id)}`);

  if (!data?.build) {
    return pageMetadata({
      title: "Работа не найдена",
      description: `Костюм косплей не найден на платформе ${SITE_NAME}.`,
      path: `/build/${id}`,
      noIndex: true,
    });
  }

  const { build, author } = data;
  const title = build.title || build.character || "Работа косплей";
  const maker = author?.displayName || author?.username || "мастер";
  const description = build.description
    ? truncate(build.description)
    : `${title}${build.franchise ? ` · ${build.franchise}` : ""} — работа ${maker}. Заказать похожий костюм косплей у фриланс мастеров на ${SITE_NAME}.`;

  return pageMetadata({
    title: `${title} — работа косплей`,
    description,
    path: `/build/${id}`,
    image: build.coverImageUrl || undefined,
  });
}

export default async function BuildLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await fetchPublicJson<BuildResponse>(`/api/builds/${encodeURIComponent(id)}`);
  const build = data?.build;
  const author = data?.author;
  const name = build?.title || build?.character || "Работа косплей";
  const maker = author?.displayName || author?.username;
  const authorUrl = author?.username
    ? `${SITE_URL}/profile/${encodeURIComponent(author.username)}`
    : undefined;

  const jsonLd = build
    ? creativeWorkJsonLd({
        name,
        description: build.description ? truncate(build.description, 200) : undefined,
        url: `${SITE_URL}/build/${id}`,
        image: build.coverImageUrl,
        authorName: maker,
        authorUrl,
        dateModified: build.updatedAt,
      })
    : null;

  return (
    <>
      {jsonLd ? <JsonLd data={jsonLd} /> : null}
      {children}
    </>
  );
}
