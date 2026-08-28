import type { Metadata, Viewport } from "next";
import { Unbounded, Onest, JetBrains_Mono, Noto_Sans_JP, Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Shell } from "@/components/Shell";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  OG_IMAGE_PATH,
  organizationJsonLd,
  SEO_KEYWORDS,
  SITE_NAME,
  SITE_URL,
  websiteJsonLd,
} from "@/lib/seo";

// Syne / Space Grotesk / Space Mono ship no Cyrillic, so every Russian string fell
// back to a system sans. These three carry the same character with cyrillic subsets.

const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

const notoJp = Noto_Sans_JP({
  variable: "--font-noto-jp",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const notoKr = Noto_Sans_KR({
  variable: "--font-noto-kr",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "AlterCosPlay — биржа готовых работ, рилсы и заказы для косплея",
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "Биржа готовых работ косплея, рилсы о процессе и контенте, заказ услуги у продавцов — в одном профиле AlterCosPlay.",
  keywords: SEO_KEYWORDS,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  icons: {
    icon: [{ url: "/logo.png", type: "image/png" }],
    apple: [{ url: "/logo.png", type: "image/png" }],
  },
  openGraph: {
    title: "AlterCosPlay — биржа готовых работ, рилсы и заказы для косплея",
    description:
      "Готовые работы косплея на бирже, рилсы о процессе и контенте, заказ услуги у продавцов — на AlterCosPlay.",
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "ru_RU",
    type: "website",
    images: [{ url: OG_IMAGE_PATH, width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AlterCosPlay — Биржа услуг, портфолио и соцсеть для косплееров",
    description:
      "Портфолио, заказы на костюмы и фриланс мастера косплея в одном профиле.",
    images: [OG_IMAGE_PATH],
  },
  verification: {
    google: "qNUgd24c8iXQfJxmLDVSbw6PwNFvUn8csntW5gANVys",
    yandex: "8bd52e2c74ec1c57",
    other: {
      "msvalidate.01": "B77C9CF21FC1E5C7C0B0218C770A2C1D",
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#12101A",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ru"
      className={`${unbounded.variable} ${onest.variable} ${jetbrainsMono.variable} ${notoJp.variable} ${notoKr.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh flex flex-col">
        <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />
        <Providers>
          <ErrorBoundary>
            <Shell>{children}</Shell>
          </ErrorBoundary>
        </Providers>
      </body>
    </html>
  );
}
