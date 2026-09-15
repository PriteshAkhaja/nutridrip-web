import type { Metadata } from "next";
import { Instrument_Sans, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const instrument = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-instrument",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "NutriDrip — IV nutrient therapy, at home, with a doctor in the loop",
    template: "%s · NutriDrip",
  },
  description:
    "Answer a 16-point health quiz, get a protocol reviewed by a registered physician, and have a nurse administer it in your own home.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${instrument.variable} ${inter.variable} ${plexMono.variable}`}>
      {/* Extensions (ColorZilla, Grammarly, password managers) stamp attributes
          onto <body> before React hydrates, which reads as a server/client
          mismatch. This suppresses the warning for THIS element's own
          attributes only — children still report real hydration bugs. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
