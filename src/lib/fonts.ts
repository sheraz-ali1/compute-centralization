import { GeistSans } from "geist/font/sans";
import { Instrument_Serif, JetBrains_Mono } from "next/font/google";

export const fontSans = GeistSans;
export const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});
export const fontSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});
