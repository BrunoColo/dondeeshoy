import Link from "next/link";
import { redirect } from "next/navigation";
import { verifyCookie } from "@/lib/admin-auth";
import { AdminSidebar } from "./admin-sidebar";

export const dynamic = "force-dynamic";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: "◆" },
  { href: "/admin/events", label: "Eventos", icon: "◇" },
  { href: "/admin/scrapers", label: "Scrapers", icon: "◇" },
  { href: "/admin/pipeline", label: "Pipeline", icon: "◈" },
  { href: "/admin/submissions", label: "Submissions", icon: "◇" },
  { href: "/admin/subscriptions", label: "Suscripciones", icon: "◇" },
];

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isAuthenticated = await verifyCookie();

  if (!isAuthenticated) {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-mono">
      <div className="flex">
        <AdminSidebar navItems={navItems} />

        {/* Main content */}
        <main className="flex-1 p-4 md:p-6 min-h-screen overflow-auto md:ml-56">
          {children}
        </main>
      </div>
    </div>
  );
}
