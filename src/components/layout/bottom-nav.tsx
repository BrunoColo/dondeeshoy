"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/config/navigation";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="glass-nav fixed bottom-0 left-0 right-0 z-50">
      <div className="mx-auto flex max-w-5xl items-center justify-around px-6 py-2"
        style={{ paddingBottom: "calc(8px + env(safe-area-inset-bottom, 0px))" }}
      >
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 px-3 py-1.5 transition-colors duration-200 min-w-[64px]",
                isActive
                  ? "text-accent-light"
                  : "text-[#A8B8CC] hover:text-[#CBD5E1]",
              )}
            >
              <Icon
                className={cn(
                  "h-[22px] w-[22px] transition-all duration-200",
                  isActive && "drop-shadow-[0_0_8px_rgba(20,184,166,0.4)]",
                )}
                strokeWidth={isActive ? 2.2 : 1.8}
              />
              <span
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-widest transition-colors duration-200 whitespace-nowrap",
                  isActive ? "text-accent-light" : "text-[#A8B8CC]",
                )}
              >
                {item.label}
              </span>

              {/* Active indicator dot — gradient teal→indigo */}
              {isActive && (
                <span className="absolute -top-0.5 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full shadow-[0_0_12px_rgba(99,102,241,0.5)]"
                  style={{ background: "linear-gradient(90deg, #14B8A6, #818CF8)" }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
