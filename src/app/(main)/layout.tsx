import { Suspense } from "react";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { DesktopSidebar } from "@/components/layout/desktop-sidebar";
import { SidebarWrapper, LayoutGrid, MainWrapper } from "@/components/layout/sidebar-wrapper";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative z-10 min-h-dvh">
      {/* Skip to main content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:bg-neon-violet focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none"
      >
        Ir al contenido principal
      </a>

      <Suspense fallback={<HeaderFallback />}>
        <Header />
      </Suspense>

      {/*
       * Layout responsivo:
       *
       * mobile (< lg):     solo main, sin sidebars
       * lg+  (≥1024px):    2 columnas: main + sidebar derecho
       *
       * El contenedor usa max-w-[1600px] para no estirarse en 4K.
       */}
      <div className="pt-[60px] safe-bottom">
        <LayoutGrid>

          {/* Main content */}
          <MainWrapper defaultClassName="min-w-0 flex-1 px-4 sm:px-6 lg:px-8 xl:px-10">
            {children}
          </MainWrapper>

          {/*
           * SidebarWrapper oculta el sidebar en /mapa y /evento/*.
           * DesktopSidebar es server component pasado como children.
           * En lg: visible (hidden lg:flex). En xl: ocupa la 3ª columna del grid.
           */}
          <SidebarWrapper>
            <div className="hidden lg:block w-[300px] shrink-0 pr-4 xl:pr-6">
              <Suspense fallback={<SidebarFallback />}>
                <DesktopSidebar />
              </Suspense>
            </div>
          </SidebarWrapper>
        </LayoutGrid>
      </div>

      <div className="sm:hidden">
        <BottomNav />
      </div>
    </div>
  );
}

function HeaderFallback() {
  return <div className="glass-header fixed top-0 left-0 right-0 z-50 h-[60px]" />;
}

function SidebarFallback() {
  return (
    <aside className="flex flex-col w-full">
      <div className="sticky top-[60px] h-[calc(100vh-60px)] flex flex-col gap-4 py-4 overflow-hidden">
        {/* Ad placeholder skeleton */}
        <div className="rounded-2xl border border-white/5 p-4 space-y-3">
          <div className="skeleton h-2.5 w-16 rounded" />
          <div className="skeleton h-[100px] w-full rounded-xl" />
          <div className="skeleton h-7 w-full rounded-lg" />
        </div>
        {/* Trending skeleton */}
        <div className="glass-card rounded-2xl p-4 space-y-3">
          <div className="skeleton h-2.5 w-24 rounded" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-2.5">
              <div className="skeleton h-3 w-3 rounded shrink-0 mt-0.5" />
              <div className="space-y-1.5 flex-1">
                <div className="skeleton h-3 w-full rounded" />
                <div className="skeleton h-2 w-2/3 rounded" />
              </div>
            </div>
          ))}
        </div>
        {/* Categories skeleton */}
        <div className="glass-card rounded-2xl p-4 space-y-3">
          <div className="skeleton h-2.5 w-20 rounded" />
          <div className="grid grid-cols-2 gap-1.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-8 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
