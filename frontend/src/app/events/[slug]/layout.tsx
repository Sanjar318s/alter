import type { Metadata } from "next";
import { fetchPublicJson, pageMetadata, truncate } from "@/lib/seo";

type EventResponse = {
  event?: {
    title?: string;
    city?: string;
    description?: string;
  };
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await fetchPublicJson<EventResponse>(
    `/api/partners/events/${encodeURIComponent(slug)}`
  );

  if (!data?.event) {
    return pageMetadata({
      title: "Событие не найдено",
      description: "Косплей-мероприятие не найдено на платформе ALTER.",
      path: `/events/${slug}`,
      noIndex: true,
    });
  }

  const { event } = data;
  const title = event.title || "Косплей-событие";
  const description = event.description
    ? truncate(event.description)
    : `${title}${event.city ? ` · ${event.city}` : ""} — мероприятие для косплееров на платформе ALTER.`;

  return pageMetadata({
    title: `${title} — косплей-ивент`,
    description,
    path: `/events/${slug}`,
  });
}

export default function EventLayout({ children }: { children: React.ReactNode }) {
  return children;
}
