"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavItem = { href: string; label: string; icon: string };

export function AdminSidebar({ navItems }: { navItems: NavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between px-4 py-3">
        <span className="text-sm font-bold text-zinc-100">dondeeshoy admin</span>
        <button
          onClick={() => setOpen(!open)}
          className="text-zinc-400 hover:text-zinc-100 transition-colors"
          aria-label="Toggle menu"
        >
          {open ? "✕" : "☰"}
        </button>
      </div>

      {/* Mobile spacer */}
      <div className="md:hidden h-[49px]" />

      {/* Backdrop */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 w-56 border-r border-zinc-800 min-h-screen h-screen p-4 flex flex-col bg-zinc-950
          transition-transform duration-200
          md:translate-x-0 md:sticky md:top-0
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="mb-8">
          <Link href="/admin" className="block" onClick={() => setOpen(false)}>
            <h1 className="text-lg font-bold text-zinc-100">dondeeshoy</h1>
            <p className="text-xs text-zinc-500">Admin Panel</p>
          </Link>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`block px-3 py-2 text-sm rounded transition-colors ${
                  active
                    ? "bg-zinc-800 text-zinc-100"
                    : "hover:bg-zinc-900 hover:text-zinc-100"
                }`}
              >
                <span className={`mr-2 ${active ? "text-zinc-300" : "text-zinc-500"}`}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
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
    </>
  );
}
