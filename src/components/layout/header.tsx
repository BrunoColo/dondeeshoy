"use client";

import { cn } from "@/lib/utils";
import { Search, X } from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Sync search input with URL param
  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    setSearchValue(q);
    if (q) setSearchOpen(true);
  }, [searchParams]);

  // Focus input when opened
  useEffect(() => {
    if (searchOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [searchOpen]);

  const submitSearch = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value.trim()) {
        params.set("q", value.trim());
      } else {
        params.delete("q");
      }
      const qs = params.toString();
      const target = pathname === "/" || pathname === "/proximos" ? pathname : "/";
      router.push(qs ? `${target}?${qs}` : target, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      submitSearch(searchValue);
    }
    if (e.key === "Escape") {
      closeSearch();
    }
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchValue("");
    // Only clear the q param
    const params = new URLSearchParams(searchParams.toString());
    if (params.has("q")) {
      params.delete("q");
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  };

  return (
    <header
      className={cn(
        "glass-header fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled ? "py-2.5" : "py-3.5",
      )}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 gap-3">
        {/* Logo — hidden when search is open on mobile */}
        <div className={cn(
          "flex items-center gap-1.5 shrink-0 transition-all duration-200",
          searchOpen && "hidden sm:flex"
        )}>
          <span className="font-display text-[18px] font-extrabold tracking-tight text-foreground">
            ¿Dónde es
          </span>
          <span className="font-display text-[18px] font-extrabold tracking-tight bg-gradient-to-r from-neon-violet via-neon-magenta to-neon-cyan bg-clip-text text-transparent">
            hoy
          </span>
          <span className="font-display text-[18px] font-extrabold tracking-tight text-foreground">
            ?
          </span>
        </div>

        {/* Search bar — expands when open */}
        {searchOpen ? (
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" strokeWidth={2} />
              <input
                ref={inputRef}
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Buscar evento, venue, género…"
                className="w-full rounded-full bg-white/[0.08] border border-white/[0.14] pl-9 pr-10 py-2.5 text-[13px] text-foreground placeholder:text-text-muted focus:outline-none focus:border-neon-violet/45 focus:shadow-[0_0_14px_rgba(168,85,247,0.2)] transition-all duration-200"
              />
              {searchValue.trim().length > 0 && (
                <button
                  onClick={() => submitSearch(searchValue)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-7 items-center justify-center rounded-full bg-neon-violet/20 border border-neon-violet/30 px-2 text-[10px] font-semibold uppercase tracking-wide text-neon-violet hover:bg-neon-violet/30"
                >
                  Ir
                </button>
              )}
            </div>
            <button
              onClick={closeSearch}
              className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] border border-white/[0.1] hover:border-white/[0.2] transition-colors"
              aria-label="Cerrar buscador"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {/* Search button */}
            <button
              onClick={() => setSearchOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.04] border border-white/[0.06] hover:border-neon-violet/30 hover:shadow-[0_0_10px_rgba(168,85,247,0.1)] transition-all duration-200"
              aria-label="Buscar"
            >
              <Search className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
