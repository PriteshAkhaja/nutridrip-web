import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Inter, Noto_Sans_Mono } from "next/font/google";
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

const mono = Noto_Sans_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono-face",
  display: "swap",
});

/**
 * Absolute URLs for OG and canonical tags are built from this. Relative paths
 * in metadata are a build error without it, so it falls back to localhost
 * rather than leaving a deploy to discover the gap.
 */
const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";

const title = "NutriDrip — IV nutrient therapy, at home, with a doctor in the loop";
const description =
  "Answer a 16-point health quiz, get a protocol reviewed by a registered physician, and have a nurse administer it in your own home.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: "%s · NutriDrip",
  },
  description,
  applicationName: "NutriDrip",
  // The consoles print doses, quantities, batch numbers and references like
  // ND-4417 in mono. iOS will turn bare digit runs into call links and change
  // how they render, so clinical figures stay plain text.
  formatDetection: { telephone: false, address: false, email: false },
  openGraph: {
    type: "website",
    siteName: "NutriDrip",
    title,
    description,
    url: siteUrl,
    locale: "en_IN",
  },
  twitter: { card: "summary_large_image", title, description },
};

/**
 * There is no dark theme — every status hue in globals.css was tuned against a
 * paper ground and several only just clear their contrast bar. Declaring the
 * scheme stops a phone force-darkening the page and undoing that work.
 */
export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#FFFFFF",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${instrument.variable} ${inter.variable} ${mono.variable}`}>
      {/* Extensions (ColorZilla, Grammarly, password managers) stamp attributes
          onto <body> before React hydrates, which reads as a server/client
          mismatch. This suppresses the warning for THIS element's own
          attributes only — children still report real hydration bugs. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
