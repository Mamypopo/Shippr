import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans_Thai } from "next/font/google";

import { SiteHeader } from "@/components/chrome/SiteHeader";
import "./globals.css";

/**
 * One superfamily, two roles. Plex Sans Thai carries Thai and Latin prose;
 * Plex Mono carries every figure, code and matrix cell, because a bay plan is
 * monospaced and because rates only compare when the digits line up.
 */
const plexThai = IBM_Plex_Sans_Thai({
  variable: "--font-plex-thai",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Shippr — ข้อมูลตลาดค่าระวางและการเลือกสายเรือ",
  description:
    "ติดตามค่าระวางเรือ ความแออัดของท่าเรือ และเลือกสายเรือด้วย AHP สำหรับ freight forwarder",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      className={`${plexThai.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-deck text-hull">
        <SiteHeader />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
