import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
const serif = Instrument_Serif({ weight: "400", style: ["normal", "italic"], subsets: ["latin"], variable: "--font-instrument" });

export const metadata: Metadata = {
  title: "Roadie: the AI tour manager with taste",
  description:
    "Roadie plans tours for independent musicians, comedians and live podcasts using Qloo's cultural taste graph: where your fans are, which venues fit, who to co-bill with, and which brands to pitch.",
};

export const viewport: Viewport = {
  themeColor: "#07080d",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Browser extensions (Grammarly, dark-mode tools) add attributes to <html> and <body> before
  // React hydrates. This ignores attribute mismatches on these two elements only, not their children.
  return (
    <html
      lang="en"
      className={`${sans.variable} ${serif.variable} ${mono.variable} antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh" suppressHydrationWarning>
        <div aria-hidden className="ambient" />
        {children}
      </body>
    </html>
  );
}
