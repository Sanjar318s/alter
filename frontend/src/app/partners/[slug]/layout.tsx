import type { Metadata } from "next";
import { fetchPublicJson, pageMetadata, truncate } from "@/lib/seo";

type PartnerResponse = {
  partner?: {
    name?: string;
    tagline?: string;
    description?: string;
    city?: string;
    type?: string;
  };
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await fetchPublicJson<PartnerResponse>(
    `/api/partners/${encodeURIComponent(slug)}`
  );

  if (!data?.partner) {
    return pageMetadata({
      title: "Партнёр не найден",
      description: "Партнёрская страница не найдена на платформе ALTER.",
      path: `/partners/${slug}`,
      noIndex: true,
    });
  }

  const { partner } = data;
  const name = partner.name || slug;
  const description = partner.description
    ? truncate(partner.description)
    : partner.tagline
      ? truncate(partner.tagline)
      : `${name}${partner.city ? ` · ${partner.city}` : ""} — партнёр платформы для косплееров ALTER.`;

  return pageMetadata({
    title: `${name} — партнёр ALTER`,
    description,
    path: `/partners/${slug}`,
  });
}

export default function PartnerSlugLayout({ children }: { children: React.ReactNode }) {
  return children;
}
