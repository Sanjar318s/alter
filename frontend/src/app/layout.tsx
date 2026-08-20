import type { Metadata, Viewport } from "next";
import { Unbounded, Onest, JetBrains_Mono, Noto_Sans_JP, Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Shell } from "@/components/Shell";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SEO_KEYWORDS, SITE_NAME, SITE_URL } from "@/lib/seo";

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
    default: "ALTER — платформа для косплееров | портфолио, заказы, коммишены",
    template: "%s | ALTER",
  },
  description:
    "Платформа для косплееров: портфолио костюмов, заказать костюм косплей у фриланс мастеров косплея, коммишены и заказы — в одном профиле.",
  keywords: SEO_KEYWORDS,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    title: "ALTER — платформа для косплееров",
    description:
      "Портфолио, заказать костюм косплей, фриланс мастера косплея и коммишены — всё на одной площадке.",
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "ru_RU",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ALTER — платформа для косплееров",
    description:
      "Портфолио, заказы на костюмы и фриланс мастера косплея в одном профиле.",
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
        <Providers>
          <ErrorBoundary>
            <Shell>{children}</Shell>
          </ErrorBoundary>
        </Providers>
      </body>
    </html>
  );
}
