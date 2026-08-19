import type { Metadata } from "next";
import { Unbounded, Onest, JetBrains_Mono, Noto_Sans_JP, Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Shell } from "@/components/Shell";
import { ErrorBoundary } from "@/components/ErrorBoundary";

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
  title: "ALTER — один профиль вместо пяти сервисов",
  description:
    "Платформа для косплееров: портфолио костюмов, статус коммишенов, истории процесса и приём заказов — в одном месте.",
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
