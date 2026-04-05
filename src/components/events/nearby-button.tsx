"use client";

import { cn } from "@/lib/utils";

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
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer",
        active
          ? "bg-accent/25 border-accent/55 text-accent-light shadow-[0_0_12px_rgba(13,148,136,0.25)] ring-1 ring-accent/30"
          : "bg-white/[0.08] border-white/[0.22] text-[#CBD5E1] hover:border-accent/40 hover:text-white hover:bg-white/[0.12]",
        className,
      )}
    >
      Cerca de mí
    </button>
  );
}
