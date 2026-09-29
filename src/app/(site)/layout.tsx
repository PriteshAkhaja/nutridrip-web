import { SiteHeader, SiteFooter } from "@/components/layout/SiteChrome";
import { LoaderProvider } from "@/components/ui/LoaderProvider";
import { RevealRoot } from "@/components/site/RevealRoot";
import { WarmPhotos } from "@/components/site/WarmPhotos";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <LoaderProvider>
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
