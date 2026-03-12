"use client";

import { cn } from "@/lib/utils";
import { EVENT_TYPE_LABELS, type EventType } from "@/types/events";
import { Search, X } from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { HEADER_NAV_ITEMS } from "@/config/navigation";

interface SearchSuggestion {
  id: string;
  slug: string;
  name: string;
  date: string;
  venueName: string;
  eventType: EventType;
}

function formatSuggestionDate(date: string) {
  try {
    return new Intl.DateTimeFormat("es-UY", {
      day: "numeric",
      month: "short",
    }).format(new Date(`${date}T00:00:00`));
  } catch {
    return date;
  }
}

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
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

  useEffect(() => {
    const query = searchValue.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setIsLoadingSuggestions(false);
      setHighlightedIndex(-1);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        setIsLoadingSuggestions(true);
        const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Search suggestions failed: ${response.status}`);
        }

        const data = (await response.json()) as { suggestions?: SearchSuggestion[] };
        setSuggestions(data.suggestions ?? []);
        setHighlightedIndex(-1);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("[header] Failed to load search suggestions", error);
        setSuggestions([]);
        setHighlightedIndex(-1);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingSuggestions(false);
        }
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [searchValue]);

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
      setSuggestions([]);
      setHighlightedIndex(-1);
      const trimmed = value.trim();
      if (trimmed) {
        // Always search across all dates via /proximos
        router.push(`/proximos?q=${encodeURIComponent(trimmed)}`, { scroll: false });
      } else {
        // Clear search: stay on current page, remove q param
        const params = new URLSearchParams(searchParams.toString());
        params.delete("q");
        const qs = params.toString();
        const target = pathname === "/" || pathname === "/proximos" ? pathname : "/";
        router.push(qs ? `${target}?${qs}` : target, { scroll: false });
      }
    },
    [router, pathname, searchParams],
  );

  const navigateToSuggestion = useCallback(
    (suggestion: SearchSuggestion) => {
      setSuggestions([]);
      setHighlightedIndex(-1);
      setSearchOpen(false);
      setSearchFocused(false);
      setSearchValue(suggestion.name);
      router.push(`/evento/${suggestion.slug}`);
    },
    [router],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (suggestions.length === 0) return;
      setHighlightedIndex((prev) => (prev + 1) % suggestions.length);
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (suggestions.length === 0) return;
      setHighlightedIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
        navigateToSuggestion(suggestions[highlightedIndex]);
        return;
      }
      submitSearch(searchValue);
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      if (searchValue.trim() || suggestions.length > 0) {
        setSuggestions([]);
        setHighlightedIndex(-1);
      } else {
        closeSearch();
      }
    }
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchValue("");
    setSearchFocused(false);
    setSuggestions([]);
    setHighlightedIndex(-1);
    setIsLoadingSuggestions(false);
    const params = new URLSearchParams(searchParams.toString());
    if (params.has("q")) {
      params.delete("q");
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  };

  const showSuggestions = searchFocused && searchValue.trim().length >= 2;

  const renderSuggestions = (isMobile: boolean) => {
    if (!showSuggestions) return null;

    return (
      <div
        className={cn(
          "absolute left-0 right-0 top-[calc(100%+0.55rem)] z-[70] overflow-hidden rounded-[24px] border border-white/[0.14] bg-[rgba(6,8,18,0.96)] backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.45)]",
          isMobile ? "max-h-[65vh]" : "max-h-[28rem]",
        )}
      >
        <div className="border-b border-white/[0.08] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7DD3FC]">
          Sugerencias rápidas
        </div>

        {isLoadingSuggestions ? (
          <div className="px-4 py-4 text-sm text-[#A8B8CC]">Buscando eventos…</div>
        ) : suggestions.length > 0 ? (
          <ul className="max-h-[inherit] overflow-y-auto py-2">
            {suggestions.map((suggestion, index) => {
              const isActive = index === highlightedIndex;

              return (
                <li key={suggestion.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => navigateToSuggestion(suggestion)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-150",
                      isActive
                        ? "bg-[linear-gradient(135deg,rgba(13,148,136,0.18),rgba(99,102,241,0.18))]"
                        : "hover:bg-white/[0.06]",
                    )}
                  >
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/[0.12] bg-white/[0.05] text-[#8B5CF6]">
                      <Search className="h-4 w-4" strokeWidth={2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-white">{suggestion.name}</div>
                      <div className="mt-1 truncate text-xs text-[#9FB0C4]">{suggestion.venueName}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[#C4D0E0]">
                        <span className="rounded-full border border-white/[0.10] bg-white/[0.04] px-2 py-0.5">
                          {EVENT_TYPE_LABELS[suggestion.eventType]}
                        </span>
                        <span>{formatSuggestionDate(suggestion.date)}</span>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="px-4 py-4 text-sm text-[#A8B8CC]">
            No encontré coincidencias directas. Probá Enter para ver todos los resultados.
          </div>
        )}

        <div className="border-t border-white/[0.08] p-2">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => submitSearch(searchValue)}
            className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-sm text-[#D7E3F3] transition-colors hover:bg-white/[0.06]"
          >
            <span className="truncate">Ver todos los resultados para “{searchValue.trim()}”</span>
            <span className="shrink-0 text-[11px] uppercase tracking-[0.16em] text-[#7DD3FC]">Enter</span>
          </button>
        </div>
      </div>
    );
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
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-accent-light pointer-events-none"
                strokeWidth={2}
              />
              <input
                ref={mobileInputRef}
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => window.setTimeout(() => setSearchFocused(false), 120)}
                placeholder="Buscar eventos…"
                className="w-full rounded-full bg-[rgba(4,4,12,0.85)] border border-white/[0.18] pl-10 pr-4 py-2.5 text-[14px] text-foreground placeholder:text-[#8A9BB0] focus:outline-none focus:border-accent/50 focus:shadow-[0_0_16px_rgba(13,148,136,0.25)] transition-all duration-200"
              />
              {renderSuggestions(true)}
            </div>
            {searchValue.trim().length > 0 && (
              <button
                onClick={() => submitSearch(searchValue)}
                className="shrink-0 inline-flex h-9 items-center justify-center rounded-full px-4 text-[12px] font-bold uppercase tracking-wide text-white transition-all hover:-translate-y-0.5"
                style={{
                  background: "linear-gradient(135deg, #0D9488 0%, #6366F1 100%)",
                  boxShadow: "0 4px 12px rgba(13,148,136,0.3)",
                }}
              >
                Ir
              </button>
            )}
            <button
              onClick={closeSearch}
              className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08] border border-white/[0.15] hover:border-white/[0.25] transition-colors"
              aria-label="Cerrar buscador"
            >
              <X className="h-4 w-4 text-[#C4D0E0]" strokeWidth={2} />
            </button>
          </div>
        )}

        {/* Mobile: logo + search button (when search is closed) */}
        {!searchOpen && (
          <div className="flex sm:hidden items-center w-full gap-3">
            <Link href="/" className="flex items-center gap-1">
              <span className="font-display text-[18px] font-extrabold tracking-tight text-[#E2E8F0]">
                ¿Dónde es
              </span>
              <span className="font-display text-[18px] font-extrabold tracking-tight gradient-animated">
                &nbsp;hoy?
              </span>
            </Link>
            <button
              onClick={() => setSearchOpen(true)}
              className="ml-auto flex h-10 items-center gap-2 rounded-full px-4 transition-all duration-200 active:scale-[0.97] cursor-pointer"
              style={{
                background: "rgba(4,4,12,0.80)",
                border: "1px solid rgba(255,255,255,0.22)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
              }}
              aria-label="Buscar"
            >
              <Search className="h-4 w-4 text-accent-light" strokeWidth={2} />
              <span className="text-[12px] text-[#A8B8CC] font-medium">Buscar…</span>
            </button>
          </div>
        )}

        {/* ══════════════════════════════════════════
            DESKTOP LAYOUT (≥ 640px)
            ══════════════════════════════════════════ */}

        {/* Desktop: Logo — always visible */}
        <div className="hidden sm:flex items-center shrink-0">
          <Link href="/" className="flex items-center gap-1 group">
            <span className="font-display text-[18px] font-extrabold tracking-tight text-[#E2E8F0] group-hover:text-white transition-colors">
              ¿Dónde es
            </span>
            <span className="font-display text-[18px] font-extrabold tracking-tight gradient-animated">
              &nbsp;hoy?
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
                    ? "text-white font-bold"
                    : "text-[#C4D0E0] hover:text-white border border-transparent hover:border-white/[0.10] hover:bg-white/[0.06]",
                )}
                style={isActive ? {
                  background: "linear-gradient(135deg, rgba(13,148,136,0.25) 0%, rgba(99,102,241,0.20) 100%)",
                  border: "1px solid rgba(13,148,136,0.35)",
                  boxShadow: "0 0 16px rgba(13,148,136,0.20), 0 0 16px rgba(99,102,241,0.10)",
                } : undefined}
              >
                <Icon
                  className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    isActive ? "text-accent-light" : "",
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
          <div className="relative w-[260px] lg:w-[340px] xl:w-[400px]">
            <Search
              className={cn(
                "absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none transition-colors duration-200",
                searchFocused || searchValue ? "text-accent-light" : "text-[#8A9BB0]",
              )}
              strokeWidth={2}
            />
            <input
              ref={desktopInputRef}
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => window.setTimeout(() => setSearchFocused(false), 120)}
              placeholder="Buscar eventos, artistas…"
              className="w-full rounded-full pl-10 pr-10 py-2 text-[13px] text-foreground placeholder:text-[#8A9BB0] focus:outline-none transition-all duration-200"
              style={{
                background: searchFocused
                  ? "rgba(6,6,18,0.95)"
                  : "rgba(4,4,12,0.80)",
                border: searchFocused
                  ? "1px solid rgba(13,148,136,0.50)"
                  : "1px solid rgba(255,255,255,0.15)",
                boxShadow: searchFocused
                  ? "0 0 20px rgba(13,148,136,0.20), 0 0 20px rgba(99,102,241,0.10)"
                  : "0 2px 8px rgba(0,0,0,0.25)",
              }}
            />
            {searchValue.trim().length > 0 ? (
              <button
                onClick={() => submitSearch(searchValue)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-7 items-center justify-center rounded-full px-3 text-[10px] font-bold uppercase tracking-wide text-white transition-all hover:scale-105"
                style={{
                  background: "linear-gradient(135deg, #0D9488 0%, #6366F1 100%)",
                  boxShadow: "0 2px 8px rgba(13,148,136,0.3)",
                }}
              >
                Ir
              </button>
            ) : searchParams.get("q") ? (
              <button
                onClick={closeSearch}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-white/[0.10] hover:bg-white/[0.18] transition-colors"
                aria-label="Limpiar búsqueda"
              >
                <X className="h-3 w-3 text-[#C4D0E0]" strokeWidth={2} />
              </button>
            ) : !searchFocused ? (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#475569] font-mono hidden lg:block">
                ⌘K
              </span>
            ) : null}
            {renderSuggestions(false)}
          </div>
        </div>

        {/* Desktop: Publicar button — gradient sólido */}
        <Link
          href="/publicar"
          className="hidden lg:flex items-center rounded-full px-5 py-2 text-[12px] font-bold text-white transition-all duration-200 shrink-0 hover:brightness-110 hover:shadow-[0_4px_20px_rgba(99,102,241,0.25)] hover:-translate-y-px active:scale-[0.97]"
          style={{
            background: "linear-gradient(135deg, #4F46E5 0%, #6366F1 50%, #0D9488 100%)",
            border: "1px solid rgba(99,102,241,0.40)",
            boxShadow: "0 2px 12px rgba(99,102,241,0.20), inset 0 1px 0 rgba(255,255,255,0.12)",
          }}
        >
          Publicar
        </Link>

      </div>
    </header>
  );
}
