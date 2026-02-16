"use client";

import { cn } from "@/lib/utils";
import { MapPin } from "lucide-react";
import { useEffect, useState } from "react";

export function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "glass-header fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled ? "py-2.5" : "py-3.5",
      )}
    >
      <div className="mx-auto flex max-w-2xl items-center justify-between px-5">
        {/* Logo */}
        <div className="flex items-center gap-1.5">
          <span className="font-display text-[17px] font-bold tracking-tight text-foreground">
            ¿Dónde es
          </span>
          <span className="font-display text-[17px] font-bold tracking-tight text-neon-violet">
            hoy
          </span>
          <span className="font-display text-[17px] font-bold tracking-tight text-foreground">
            ?
          </span>
        </div>

        {/* City indicator */}
        <div className="flex items-center gap-1.5 rounded-full bg-white/[0.04] border border-white/[0.06] px-3 py-1.5">
          <MapPin className="h-3 w-3 text-neon-violet" strokeWidth={2.5} />
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Montevideo
          </span>
        </div>
      </div>
    </header>
  );
}
