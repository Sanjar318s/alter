import type { Metadata } from "next";
import { fetchPublicJson, pageMetadata, truncate } from "@/lib/seo";

type BuildResponse = {
  build?: {
    title?: string;
    character?: string;
    franchise?: string;
    description?: string;
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
      title: "Билд не найден",
      description: "Костюм косплей не найден на платформе ALTER.",
      path: `/build/${id}`,
      noIndex: true,
    });
  }

  const { build, author } = data;
  const title = build.title || build.character || "Билд косплей";
  const maker = author?.displayName || author?.username || "мастер";
  const description = build.description
    ? truncate(build.description)
    : `${title}${build.franchise ? ` · ${build.franchise}` : ""} — работа ${maker}. Заказать похожий костюм косплей у фриланс мастеров на ALTER.`;

  return pageMetadata({
    title: `${title} — билд косплей`,
    description,
    path: `/build/${id}`,
  });
}

export default function BuildLayout({ children }: { children: React.ReactNode }) {
  return children;
}
