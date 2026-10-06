import { SiteHeader, SiteFooter } from "@/components/layout/SiteChrome";
import { LoaderProvider } from "@/components/ui/LoaderProvider";
import { RevealRoot } from "@/components/site/RevealRoot";
import { WarmPhotos } from "@/components/site/WarmPhotos";

/**
 * A reload of a public page starts at the top, not where the reader was:
 * browsers restore the old position by default, and on the scroll-driven pages
 * that reopens the page halfway through its act.
 *
 * The browser decides whether to restore when a page is LEFT, from
 * history.scrollRestoration at that moment, so: on leaving, restoring is
 * switched off and the position is kept in this tab's sessionStorage. On the
 * next load, a reload stays at the top (or opens its #section); Back and
 * Forward into a fresh copy of the page are put back where the reader was,
 * from that note. After load restoring is switched on again, so Back and
 * Forward between pages inside the site (no page load) work as before.
 * The staff consoles keep the browser's normal behaviour.
 */
const RELOAD_FROM_TOP = `(function(){try{if(!("scrollRestoration" in history))return;var key=function(){return "nd_y:"+location.pathname+location.search};var n=performance.getEntriesByType("navigation")[0],t=n&&n.type;var at=function(f){if(document.readyState==="complete")f();else addEventListener("load",f,{once:true})};if(t==="back_forward"){var y=+sessionStorage.getItem(key());if(y>0)at(function(){window.scrollTo({top:y,behavior:"instant"})})}else if(t==="reload"&&location.hash){at(function(){var el=document.getElementById(decodeURIComponent(location.hash.slice(1)));if(el)el.scrollIntoView({behavior:"instant"})})}at(function(){setTimeout(function(){history.scrollRestoration="auto"},0)});addEventListener("pagehide",function(){try{sessionStorage.setItem(key(),String(Math.round(window.scrollY)))}catch(e){}history.scrollRestoration="manual"})}catch(e){}})();`;

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <LoaderProvider>
      <script dangerouslySetInnerHTML={{ __html: RELOAD_FROM_TOP }} />
      <div className="site min-h-dvh flex flex-col">
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </div>
      <RevealRoot />
      <WarmPhotos />
    </LoaderProvider>
  );
}
