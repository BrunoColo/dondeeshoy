"use client";

import { cn } from "@/lib/utils";
import { Navigation, Loader2 } from "lucide-react";

interface NearbyButtonProps {
  active: boolean;
  loading: boolean;
  onClick: () => void;
  className?: string;
}

export function NearbyButton({ active, loading, onClick, className }: NearbyButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-all duration-200",
        active
          ? "bg-accent/20 border-accent/45 text-accent-light shadow-[0_0_10px_rgba(13,148,136,0.2)] ring-1 ring-accent/25"
          : "bg-white/[0.03] border-white/[0.08] text-muted-foreground hover:border-accent/25 hover:text-foreground",
        className,
      )}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.5} /> : <Navigation className="h-3.5 w-3.5" strokeWidth={2.5} />}
      Cerca de mí
    </button>
  );
}
