import type { Metadata } from "next";
import { Anton, Inter, JetBrains_Mono } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";

const anton = Anton({ weight: "400", subsets: ["latin"], variable: "--font-anton" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-jb" });

export const metadata: Metadata = {
  title: "Roadie: the AI tour manager with taste",
  description:
    "Roadie plans tours for independent musicians, comedians and live podcasts using Qloo's cultural taste graph: where your fans are, which venues fit, who to co-bill with, and which brands to pitch.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Browser extensions (Grammarly, dark-mode tools) add attributes to <html> and <body> before
  // React hydrates. This ignores attribute mismatches on these two elements only, not their children.
  return (
    <html
      lang="en"
      className={`${anton.variable} ${inter.variable} ${mono.variable} antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-screen" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
