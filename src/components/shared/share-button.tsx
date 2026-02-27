"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { MessageCircle, Share2, Check, Copy, ChevronUp } from "lucide-react";

interface ShareButtonProps {
  title: string;
  path: string;
  variant?: "icon" | "full";
  className?: string;
  stopPropagation?: boolean;
}

export function ShareButton({
  title,
  path,
  variant = "icon",
  className,
  stopPropagation = false,
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const absoluteUrl = useMemo(() => {
    if (typeof window === "undefined") return path;
    return new URL(path, window.location.origin).toString();
  }, [path]);

  const whatsappUrl = useMemo(
    () => `https://wa.me/?text=${encodeURIComponent(`${title} ${absoluteUrl}`)}`,
    [title, absoluteUrl],
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const maybeStop = (e: React.MouseEvent) => {
    if (!stopPropagation) return;
    e.preventDefault();
    e.stopPropagation();
  };

  const handleToggle = (e: React.MouseEvent) => {
    maybeStop(e);
    // If native share is available and we're in icon mode, just share directly
    if (variant === "icon" && typeof navigator !== "undefined" && navigator.share) {
      navigator.share({ title, text: title, url: absoluteUrl }).catch(() => {});
      return;
    }
    setOpen((prev) => !prev);
  };

  const handleCopy = async (e: React.MouseEvent) => {
    maybeStop(e);
    setOpen(false);
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(absoluteUrl);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      } catch {
        // no-op
      }
    }
  };

  const handleWhatsapp = (e: React.MouseEvent) => {
    maybeStop(e);
    setOpen(false);
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  if (variant === "icon") {
    return (
      <div ref={containerRef} className={cn("relative", className)}>
        <button
          type="button"
          onClick={handleToggle}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/45 backdrop-blur-md border border-white/15 text-white transition-colors hover:bg-black/65"
          aria-label={copied ? "Link copiado" : "Compartir evento"}
          title={copied ? "Link copiado" : "Compartir"}
        >
          {copied ? <Check className="h-4 w-4" strokeWidth={2.8} /> : <Share2 className="h-4 w-4" strokeWidth={2.3} />}
        </button>

        {/* Dropdown for icon variant (shown when no native share) */}
        {open && (
          <div
            className="absolute right-0 bottom-10 z-50 min-w-[160px] rounded-xl border border-white/[0.1] bg-[#0D0D1A]/95 backdrop-blur-xl shadow-2xl overflow-hidden"
            onClick={(e) => { if (stopPropagation) { e.preventDefault(); e.stopPropagation(); } }}
          >
            <button
              type="button"
              onClick={handleWhatsapp}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-[12px] font-medium text-emerald-300 hover:bg-emerald-500/10 transition-colors"
            >
              <MessageCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={2.3} />
              WhatsApp
            </button>
            <div className="h-px bg-white/[0.06]" />
            <button
              type="button"
              onClick={handleCopy}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-[12px] font-medium text-muted-foreground hover:bg-white/[0.05] hover:text-foreground transition-colors"
            >
              <Copy className="h-3.5 w-3.5 shrink-0" strokeWidth={2.3} />
              Copiar link
            </button>
          </div>
        )}
      </div>
    );
  }

  // Full variant — single button with dropdown
  return (
    <div ref={containerRef} className={cn("relative inline-block", className)}>
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-all",
          open
            ? "bg-white/[0.08] border-white/[0.2] text-foreground"
            : "bg-white/[0.04] border-white/[0.1] text-foreground hover:border-white/[0.2]",
        )}
      >
        {copied
          ? <Check className="h-3.5 w-3.5 text-neon-green" strokeWidth={2.8} />
          : <Share2 className="h-3.5 w-3.5" strokeWidth={2.3} />
        }
        {copied ? "Copiado" : "Compartir"}
        <ChevronUp
          className={cn("h-3 w-3 opacity-50 transition-transform duration-200", !open && "rotate-180")}
          strokeWidth={2.5}
        />
      </button>

      {open && (
        <div className="absolute left-0 bottom-10 z-50 min-w-[180px] rounded-xl border border-white/[0.1] bg-[#0D0D1A]/95 backdrop-blur-xl shadow-2xl overflow-hidden">
          <button
            type="button"
            onClick={handleWhatsapp}
            className="flex w-full items-center gap-2.5 px-4 py-3 text-[13px] font-medium text-emerald-300 hover:bg-emerald-500/10 transition-colors"
          >
            <MessageCircle className="h-4 w-4 shrink-0" strokeWidth={2.3} />
            WhatsApp
          </button>
          <div className="h-px bg-white/[0.06]" />
          <button
            type="button"
            onClick={handleCopy}
            className="flex w-full items-center gap-2.5 px-4 py-3 text-[13px] font-medium text-muted-foreground hover:bg-white/[0.05] hover:text-foreground transition-colors"
          >
            <Copy className="h-4 w-4 shrink-0" strokeWidth={2.3} />
            Copiar link
          </button>
        </div>
      )}
    </div>
  );
}
