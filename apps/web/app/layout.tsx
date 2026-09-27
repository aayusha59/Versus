import type { Metadata, Viewport } from "next";
import "./globals.css";
import { mono, sans } from "@/lib/fonts";
import { Providers } from "./providers";
import { HeroHeader } from "@/components/Nav";
import FooterSection from "@/components/Footer";

export const metadata: Metadata = {
  title: { default: "Versus", template: "%s | Versus" },
  description: "Prediction duels on Solana. Back a side, get paid in the stock it is made of.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${sans.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">
        <a className="skip" href="#main">
          Skip to content
        </a>
        <Providers>
          <HeroHeader />
          {children}
          <FooterSection />
        </Providers>
      </body>
    </html>
  );
}
