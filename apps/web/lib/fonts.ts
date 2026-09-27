import { Geist, Geist_Mono } from "next/font/google";

/** Body, headlines and UI, as on the landing template. */
export const sans = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-sans",
});

/** Kickers, labels, numerals, wallet keys. */
export const mono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
});
