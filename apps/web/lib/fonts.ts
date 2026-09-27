import { Archivo, Instrument_Serif } from "next/font/google";

/**
 * Archivo variable with the width axis, so headlines can sit at wdth 75 (fight-poster)
 * and the wordmark at wdth 62, from one file. Weight axis loads in full by default.
 */
export const archivo = Archivo({
  subsets: ["latin"],
  display: "swap",
  axes: ["wdth"],
  variable: "--font-archivo",
});

/** Editorial accent. Only the italic is used in the UI; roman is loaded for fallback safety. */
export const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-instrument",
});
