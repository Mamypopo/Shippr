import type { Metadata } from "next";
import { Anuphan, Chakra_Petch } from "next/font/google";

import { SiteHeader } from "@/components/chrome/SiteHeader";
import "./globals.css";

/**
 * Two Thai-first families, chosen against the subject rather than reached for.
 *
 * Chakra Petch is angular and squared off — the vernacular of stencilled
 * markings on container doors and port machinery — and carries every heading
 * and figure. Anuphan is a calm geometric Thai sans for prose. Neither is the
 * Plex-plus-monospace pairing that makes technical pages interchangeable.
 */
const chakra = Chakra_Petch({
  variable: "--font-chakra",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const anuphan = Anuphan({
  variable: "--font-anuphan",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600"],
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
      className={`${chakra.variable} ${anuphan.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-deck text-hull">
        <SiteHeader />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
