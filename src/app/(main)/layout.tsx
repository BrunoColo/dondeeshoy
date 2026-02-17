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
      <main className="safe-bottom pt-[60px]">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}

function HeaderFallback() {
  return <div className="glass-header fixed top-0 left-0 right-0 z-50 h-[60px]" />;
}
