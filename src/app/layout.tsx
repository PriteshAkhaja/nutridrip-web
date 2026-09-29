import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Inter, Noto_Sans_Mono } from "next/font/google";
import { connection } from "next/server";
import { ClockProvider } from "@/components/ClockProvider";
import { getClockFormat } from "@/lib/settings/clock";
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

/**
 * Runs before first paint, and sets two classes on <html>.
 *
 * `reveal-on`, with motion allowed: the public site's first screen plays its
 * entrance straight from CSS, and RevealRoot may hold back what is below the
 * screen until it scrolls in. It hides nothing by itself, so a page is never
 * left blank waiting for JavaScript.
 *
 * `intro-pending`, on a visitor's first page of the day: the intro loader,
 * already in the HTML, shows from the first frame and plays entirely in CSS
 * (see globals.css), the page holds still under it, and the first screen
 * holds its entrance. This script runs the rest, so none of it waits for the
 * page's JavaScript bundles:
 * - when the count's animation starts, the day is marked in localStorage
 *   (`nd_intro_at`), so a reload or a new tab does not replay it;
 * - when the count ends, `intro-pending` becomes `intro-leaving` (the fade;
 *   the page is released and `nd:intro-done` fires), and when the fade ends
 *   the class goes (`nd:intro-end`);
 * - if the count has not started within four seconds (no loader on this page,
 *   or a first paint that slow), the flag simply comes off. A count already
 *   under way is always allowed to finish.
 * With reduced motion there is no intro at all; with storage unavailable
 * there is no telling a first visit from a tenth, so there is none either.
 *
 * `page-ready`, once the load event has passed and the browser is idle: only
 * then do the endless animations (marquees, drifting chips, the reviews'
 * autoplay) start, so they never compete with the page loading.
 */
const REVEAL_BOOT = `try{var d=document.documentElement,w=window,c=d.classList;var ready=function(){c.add('page-ready')};if(document.readyState==='complete')ready();else w.addEventListener('load',function(){(w.requestIdleCallback||function(f){setTimeout(f,200)})(ready,{timeout:1200})});var calm=!w.matchMedia||matchMedia('(prefers-reduced-motion: reduce)').matches;if(!calm&&'IntersectionObserver' in w){c.add('reveal-on')}var s=false;if(!calm){try{var a=+localStorage.getItem('nd_intro_at');s=!(a>0&&Date.now()-a<864e5)}catch(e){}}if(s){c.add('intro-pending');var go=0;var leave=function(){if(!c.contains('intro-pending'))return;c.remove('intro-pending');c.add('intro-leaving');w.dispatchEvent(new Event('nd:intro-done'))};var end=function(){if(!c.contains('intro-leaving'))return;c.remove('intro-leaving');w.dispatchEvent(new Event('nd:intro-end'))};document.addEventListener('animationstart',function(e){if(e.animationName!=='ndIntroCount'||go)return;go=1;try{localStorage.setItem('nd_intro_at',String(Date.now()))}catch(x){}setTimeout(function(){leave();setTimeout(end,600)},2500)});document.addEventListener('animationend',function(e){if(e.animationName==='ndIntroCount')leave();else if(e.animationName==='ndIntroOut')end()});setTimeout(function(){if(go||!c.contains('intro-pending'))return;c.remove('intro-pending');w.dispatchEvent(new Event('nd:intro-done'));w.dispatchEvent(new Event('nd:intro-end'))},4000)}}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The 12- or 24-hour choice (Admin → Settings) reaches every client
  // component through ClockProvider. Read per request, never at build time:
  // the build has no database, and a baked-in format would ignore the setting.
  await connection();
  const clockFormat = await getClockFormat();

  return (
    // data-scroll-behavior: Next 16 reads it to switch smooth scrolling off
    // around a route change, so only in-page anchors glide.
    // suppressHydrationWarning: REVEAL_BOOT adds classes to <html> before React
    // hydrates. It covers this element's own attributes only.
    <html
      lang="en-IN"
      className={`${instrument.variable} ${inter.variable} ${mono.variable}`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: REVEAL_BOOT }} />
      </head>
      {/* Extensions (ColorZilla, Grammarly, password managers) stamp attributes
          onto <body> before React hydrates, which reads as a server/client
          mismatch. This suppresses the warning for THIS element's own
          attributes only — children still report real hydration bugs. */}
      <body suppressHydrationWarning>
        <ClockProvider format={clockFormat}>{children}</ClockProvider>
      </body>
    </html>
  );
}
