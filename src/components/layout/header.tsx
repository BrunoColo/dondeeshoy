"use client";

import { cn } from "@/lib/utils";
import { Search, X, Plus } from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { HEADER_NAV_ITEMS } from "@/config/navigation";

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const desktopInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Sync search input with URL param
  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    queueMicrotask(() => {
      setSearchValue((prev) => (prev === q ? prev : q));
      if (q) setSearchOpen(true);
    });
  }, [searchParams]);

  // Focus the mobile input when search opens
  useEffect(() => {
    if (!searchOpen) return;
    const t = setTimeout(() => {
      mobileInputRef.current?.focus();
    }, 50);
    return () => clearTimeout(t);
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
    if (e.key === "Enter") submitSearch(searchValue);
    if (e.key === "Escape") closeSearch();
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchValue("");
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
        scrolled ? "py-2" : "py-3",
      )}
    >
      <div className="mx-auto flex max-w-[1600px] items-center px-4 sm:px-5 gap-3">

        {/* ══════════════════════════════════════════
            MOBILE LAYOUT (< 640px)
            ══════════════════════════════════════════ */}

        {/* Mobile: search overlay — full width, replaces everything */}
        {searchOpen && (
          <div className="flex sm:hidden items-center gap-2 w-full">
            <div className="relative flex-1 min-w-0">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
                strokeWidth={2}
              />
              <input
                ref={mobileInputRef}
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Buscar eventos…"
                className="w-full rounded-full bg-white/[0.08] border border-white/[0.14] pl-10 pr-4 py-2.5 text-[14px] text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent/45 focus:shadow-[0_0_14px_rgba(13,148,136,0.2)] transition-all duration-200"
              />
            </div>
            {searchValue.trim().length > 0 && (
              <button
                onClick={() => submitSearch(searchValue)}
                className="shrink-0 inline-flex h-9 items-center justify-center rounded-full bg-accent/20 border border-accent/30 px-3.5 text-[12px] font-semibold uppercase tracking-wide text-accent-light hover:bg-accent/30 transition-colors"
              >
                Ir
              </button>
            )}
            <button
              onClick={closeSearch}
              className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] border border-white/[0.1] hover:border-white/[0.2] transition-colors"
              aria-label="Cerrar buscador"
            >
              <X className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
            </button>
          </div>
        )}

        {/* Mobile: logo + search button (when search is closed) */}
        {!searchOpen && (
          <div className="flex sm:hidden items-center w-full gap-3">
            <Link href="/" className="flex items-center gap-[3px]">
              <span className="font-display text-[17px] font-extrabold tracking-tight text-[#E2E8F0]">
                ¿Dónde es
              </span>
              <span className="font-display text-[17px] font-extrabold tracking-tight gradient-animated">
                hoy?
              </span>
            </Link>
            <button
              onClick={() => setSearchOpen(true)}
              className="ml-auto flex h-10 items-center gap-2 rounded-full bg-white/[0.06] border border-white/[0.10] px-3.5 hover:border-accent/30 hover:shadow-[0_0_12px_rgba(13,148,136,0.12)] active:scale-[0.97] transition-all duration-200"
              aria-label="Buscar"
            >
              <Search className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
              <span className="text-[12px] text-text-muted font-medium">Buscar…</span>
            </button>
          </div>
        )}

        {/* ══════════════════════════════════════════
            DESKTOP LAYOUT (≥ 640px)
            ══════════════════════════════════════════ */}

        {/* Desktop: Logo — always visible */}
        <div className="hidden sm:flex items-center shrink-0">
          <Link href="/" className="flex items-center gap-[3px]">
            <span className="font-display text-[17px] font-extrabold tracking-tight text-[#E2E8F0]">
              ¿Dónde es
            </span>
            <span className="font-display text-[17px] font-extrabold tracking-tight gradient-animated">
              hoy?
            </span>
          </Link>
        </div>

        {/* Desktop: Nav links — centered */}
        <nav className="hidden sm:flex items-center gap-1 flex-1 justify-center">
          {HEADER_NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/#top"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold tracking-wide transition-all duration-200",
                  isActive
                    ? "bg-accent/20 border border-accent/40 text-accent-light shadow-[0_0_16px_rgba(13,148,136,0.25)] font-bold"
                    : "text-[#B8C5D6] hover:text-foreground hover:bg-white/[0.06] border border-transparent",
                )}
              >
                <Icon
                  className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    isActive && "drop-shadow-[0_0_6px_rgba(20,184,166,0.5)]",
                  )}
                  strokeWidth={isActive ? 2.2 : 1.8}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Desktop: Search — always visible inline bar */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <div className="relative w-[240px] lg:w-[300px]">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
              strokeWidth={2}
            />
            <input
              ref={desktopInputRef}
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Buscar eventos, artistas, lugares…"
              className="w-full rounded-full bg-white/[0.07] border border-white/[0.12] pl-10 pr-10 py-2 text-[13px] text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:bg-white/[0.10] focus:shadow-[0_0_18px_rgba(13,148,136,0.20)] transition-all duration-200"
            />
            {searchValue.trim().length > 0 ? (
              <button
                onClick={() => submitSearch(searchValue)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-7 items-center justify-center rounded-full bg-accent/25 border border-accent/35 px-2.5 text-[10px] font-semibold uppercase tracking-wide text-accent-light hover:bg-accent/35 transition-colors"
              >
                Ir
              </button>
            ) : searchParams.get("q") ? (
              <button
                onClick={closeSearch}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-white/[0.08] hover:bg-white/[0.15] transition-colors"
                aria-label="Limpiar búsqueda"
              >
                <X className="h-3 w-3 text-muted-foreground" strokeWidth={2} />
              </button>
            ) : null}
          </div>
        </div>

        {/* Desktop: Publicar button — visible only on lg+ */}
        <Link
          href="/publicar"
          className="hidden lg:flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold border border-white/[0.12] text-muted-foreground hover:text-foreground hover:border-accent/30 hover:bg-accent/[0.08] transition-all duration-200 shrink-0"
        >
          <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          Publicar
        </Link>

      </div>
    </header>
  );
}
