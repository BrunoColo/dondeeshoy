import { Suspense } from "react";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative z-10 min-h-dvh">
      {/* Skip to main content — visible on focus for keyboard/screen reader users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:bg-neon-violet focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none"
      >
        Ir al contenido principal
      </a>
      <Suspense fallback={<HeaderFallback />}>
        <Header />
      </Suspense>
      <main id="main-content" className="pt-[60px] safe-bottom">
        {children}
      </main>
      <div className="sm:hidden">
        <BottomNav />
      </div>
    </div>
  );
}

function HeaderFallback() {
  return <div className="glass-header fixed top-0 left-0 right-0 z-50 h-[60px]" />;
}
