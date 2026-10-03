import type { Metadata } from "next";
import { Anuphan, IBM_Plex_Mono } from "next/font/google";

import { SiteHeader } from "@/components/chrome/SiteHeader";
import { ToastProvider } from "@/components/chrome/Toast";
import "./globals.css";

/**
 * A neutral Thai grotesque for everything readable, and a monospace for the
 * small uppercase metadata labels and for figures that need to align in a
 * column. Two roles, clearly separated.
 */
const anuphan = Anuphan({
  variable: "--font-anuphan",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
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
      className={`${anuphan.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-ground text-ink">
        <ToastProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
        </ToastProvider>
      </body>
    </html>
  );
}
