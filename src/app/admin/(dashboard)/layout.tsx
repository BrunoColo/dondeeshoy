import Link from "next/link";
import { redirect } from "next/navigation";
import { verifyCookie } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: "◆" },
  { href: "/admin/scrapers", label: "Scrapers", icon: "◇" },
  { href: "/admin/pipeline", label: "Pipeline", icon: "◈" },
  { href: "/admin/submissions", label: "Submissions", icon: "◇" },
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
        {/* Sidebar */}
        <aside className="w-56 shrink-0 border-r border-zinc-800 min-h-screen p-4 flex flex-col sticky top-0 h-screen">
          <div className="mb-8">
            <Link href="/admin" className="block">
              <h1 className="text-lg font-bold text-zinc-100">dondeeshoy</h1>
              <p className="text-xs text-zinc-500">Admin Panel</p>
            </Link>
          </div>

          <nav className="flex-1 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block px-3 py-2 text-sm hover:bg-zinc-900 hover:text-zinc-100 rounded transition-colors"
              >
                <span className="text-zinc-500 mr-2">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="pt-4 border-t border-zinc-800 space-y-2">
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="block px-3 py-2 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              ↗ Ver sitio público
            </a>
            <form action="/api/admin/logout" method="POST">
              <button
                type="submit"
                className="w-full text-left px-3 py-2 text-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 rounded transition-colors"
              >
                ← Logout
              </button>
            </form>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-6 min-h-screen overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
