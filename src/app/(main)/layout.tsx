import { Suspense } from "react";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { DesktopSidebar } from "@/components/layout/desktop-sidebar";
import { SidebarWrapper, LeftPanelWrapper } from "@/components/layout/sidebar-wrapper";
import { LeftFilterPanel } from "@/components/layout/left-filter-panel";
import { getFilterOptions } from "@/lib/queries";
import { getTodayUY } from "@/lib/format";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fetch filter options for the left panel (server-side, cached via ISR)
  const today = getTodayUY();
  const filterOptions = await getFilterOptions(today);

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
       * lg (1024-1279px):  2 columnas: main + sidebar derecho
       * xl (≥ 1280px):     3 columnas: panel izquierdo + main + sidebar derecho
       *
       * El contenedor usa max-w-[1600px] para no estirarse en 4K.
       */}
      <div className="pt-[60px] safe-bottom">
        {/*
         * lg (1024-1279px): flex con 2 columnas — main + sidebar derecho.
         * xl (≥1280px):     grid de 3 columnas — panel izquierdo + main + sidebar derecho.
         */}
        <div className="mx-auto max-w-[1600px] lg:flex lg:items-start xl:grid xl:grid-cols-[240px_1fr_280px]">

          {/*
           * Panel izquierdo — filtros persistentes.
           * Solo visible en xl+ (≥1280px) — el componente tiene hidden xl:flex.
           * LeftPanelWrapper lo oculta en /mapa y /evento/*.
           * Wrapped in Suspense porque LeftFilterPanel usa useSearchParams.
           */}
          <LeftPanelWrapper>
            <Suspense fallback={<LeftPanelFallback />}>
              <LeftFilterPanel
                availableTypes={filterOptions.types}
                availableDepartments={filterOptions.departments}
              />
            </Suspense>
          </LeftPanelWrapper>

          {/* Main content — tiene su propio padding y max-width interno */}
          <main
            id="main-content"
            className="min-w-0 flex-1 px-4 sm:px-6 lg:px-8 xl:px-10"
          >
            {children}
          </main>

          {/*
           * SidebarWrapper oculta el sidebar en /mapa y /evento/*.
           * DesktopSidebar es server component pasado como children.
           * En lg: visible (hidden lg:flex). En xl: ocupa la 3ª columna del grid.
           */}
          <SidebarWrapper>
            <Suspense fallback={<SidebarFallback />}>
              {/* Padding derecho mínimo para que no quede pegado al borde */}
              <div className="pr-4 xl:pr-6">
                <DesktopSidebar />
              </div>
            </Suspense>
          </SidebarWrapper>
        </div>
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

function LeftPanelFallback() {
  return (
    <aside className="hidden xl:flex flex-col w-[240px] shrink-0">
      <div className="sticky top-[60px] h-[calc(100vh-60px)] flex flex-col gap-4 py-4 pl-4 xl:pl-6 overflow-hidden">
        {/* Header skeleton */}
        <div className="flex items-center gap-2 px-1">
          <div className="skeleton h-3.5 w-3.5 rounded" />
          <div className="skeleton h-2.5 w-12 rounded" />
        </div>
        {/* Quick filters skeleton */}
        <div className="glass-card rounded-2xl p-3 space-y-2">
          <div className="skeleton h-2 w-14 rounded mb-2" />
          <div className="skeleton h-9 w-full rounded-xl" />
          <div className="skeleton h-9 w-full rounded-xl" />
        </div>
        {/* Type filters skeleton */}
        <div className="glass-card rounded-2xl p-3 space-y-1.5">
          <div className="skeleton h-2 w-20 rounded mb-2" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-9 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </aside>
  );
}

function SidebarFallback() {
  return (
    <aside className="hidden lg:flex flex-col w-[260px] xl:w-[280px] shrink-0 pr-4 xl:pr-6">
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
