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
      <Suspense fallback={<HeaderFallback />}>
        <Header />
      </Suspense>
      <main className="pt-[60px] safe-bottom">
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
