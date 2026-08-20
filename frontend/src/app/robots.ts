import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/explore", "/about", "/help", "/contacts", "/rules", "/privacy", "/partners", "/profile/", "/build/", "/events/"],
        disallow: [
          "/admin",
          "/studio",
          "/messages",
          "/me",
          "/login",
          "/register",
          "/partner",
          "/channels/",
          "/u/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
