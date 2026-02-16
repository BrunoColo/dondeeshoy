import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative z-10 min-h-dvh">
      <Header />
      <main className="safe-bottom pt-[60px]">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
