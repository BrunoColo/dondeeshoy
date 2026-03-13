"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart } from "lucide-react";
import { useFavorites } from "@/hooks/use-favorites";
import { cn } from "@/lib/utils";

export function FavoritesFab() {
  const pathname = usePathname();
  const { count, hydrated } = useFavorites();

  if (pathname.startsWith("/favoritos")) {
    return null;
  }

  return (
    <Link
      href="/favoritos"
      aria-label={hydrated && count > 0 ? `Ver favoritos (${count})` : "Ver favoritos"}
      title="Favoritos"
      className={cn(
        "fixed bottom-[84px] right-4 z-[55] inline-flex h-14 w-14 items-center justify-center rounded-full border border-teal-300/45",
        "bg-[linear-gradient(135deg,rgba(20,184,166,0.95)_0%,rgba(99,102,241,0.95)_100%)] text-white",
        "shadow-[0_12px_28px_rgba(0,0,0,0.35),0_0_22px_rgba(20,184,166,0.34)] transition-transform duration-200 hover:scale-[1.03] active:scale-95",
      )}
    >
      <Heart className="h-6 w-6" strokeWidth={2.4} />

      {hydrated && count > 0 && (
        <span className="absolute -top-1 -right-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full border border-white/25 bg-[#0b1324] px-1 text-[10px] font-bold leading-none text-teal-200">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
