import type { Metadata, Viewport } from "next";
import "./globals.css";
import { archivo, instrument } from "@/lib/fonts";
import { Providers } from "./providers";
import { Rail } from "@/components/Rail";

export const metadata: Metadata = {
  title: { default: "Versus", template: "%s | Versus" },
  description: "Back a side. Get paid in what it is made of.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f4f1ea",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${instrument.variable}`}>
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <Providers>
          <div className="shell">
            <Rail />
            <main id="main" className="shell-main pb-24">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
