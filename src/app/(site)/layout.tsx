import { SiteHeader, SiteFooter } from "@/components/layout/SiteChrome";
import { LoaderProvider } from "@/components/ui/LoaderProvider";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <LoaderProvider>
      <div className="min-h-dvh flex flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </div>
    </LoaderProvider>
  );
}
