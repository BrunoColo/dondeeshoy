"use client";

import { cn } from "@/lib/utils";
import { Music, CalendarDays } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  {
    label: "Hoy",
    href: "/",
    icon: Music,
  },
  {
    label: "Próximos",
    href: "/proximos",
    icon: CalendarDays,
  },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="glass-nav fixed bottom-0 left-0 right-0 z-50">
      <div className="mx-auto flex max-w-2xl items-center justify-around px-6 py-2"
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
                "relative flex flex-col items-center gap-1 px-6 py-1.5 transition-colors duration-200",
                isActive
                  ? "text-neon-violet"
                  : "text-text-muted hover:text-muted-foreground",
              )}
            >
              <Icon
                className={cn(
                  "h-[22px] w-[22px] transition-all duration-200",
                  isActive && "drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]",
                )}
                strokeWidth={isActive ? 2.2 : 1.8}
              />
              <span
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-widest transition-colors duration-200",
                  isActive ? "text-neon-violet" : "text-text-muted",
                )}
              >
                {item.label}
              </span>

              {/* Active indicator dot */}
              {isActive && (
                <span className="absolute -top-0.5 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-neon-violet shadow-[0_0_12px_rgba(168,85,247,0.6)]" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
