"use client";

import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFavorites } from "@/hooks/use-favorites";

interface FavoriteButtonProps {
  slug: string;
  className?: string;
  stopPropagation?: boolean;
  variant?: "icon" | "inline";
}

export function FavoriteButton({
  slug,
  className,
  stopPropagation = false,
  variant = "icon",
}: FavoriteButtonProps) {
  const { hydrated, isFavorite, toggleFavorite } = useFavorites();
  const active = hydrated ? isFavorite(slug) : false;

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (stopPropagation) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (!active) {
      event.currentTarget.animate(
        [
          { transform: "scale(1)", filter: "drop-shadow(0 0 0 rgba(20,184,166,0))" },
          { transform: "scale(1.1)", filter: "drop-shadow(0 0 10px rgba(20,184,166,0.45))" },
          { transform: "scale(1)", filter: "drop-shadow(0 0 0 rgba(20,184,166,0))" },
        ],
        { duration: 240, easing: "ease-out" },
      );
    }

    toggleFavorite(slug);
  };

  const label = active ? "Quitar de favoritos" : "Guardar en favoritos";

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label={label}
        aria-pressed={active}
        title={label}
        className={cn(
          "inline-flex min-h-10 items-center gap-2 rounded-full border px-3 py-2 text-[12px] font-semibold transition-all duration-200",
          active
            ? "border-teal-400/45 bg-gradient-to-r from-teal-500/20 to-indigo-500/20 text-teal-100 shadow-[0_0_18px_rgba(20,184,166,0.24)]"
            : "border-white/18 bg-black/35 text-[#D3E0F0] hover:border-white/28 hover:text-white",
          className,
        )}
      >
        {active ? "Guardado" : "Favorito"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-md transition-all duration-200",
        active
          ? "border-teal-400/55 bg-gradient-to-br from-teal-500/30 to-indigo-500/30 text-teal-200 shadow-[0_0_18px_rgba(20,184,166,0.30)]"
          : "border-white/18 bg-black/45 text-white hover:bg-black/65 hover:border-white/28",
        className,
      )}
    >
      <Heart
        className={cn(
          "h-4.5 w-4.5 transition-all duration-200",
          active ? "fill-current" : "",
        )}
        strokeWidth={active ? 2.4 : 2.1}
      />
    </button>
  );
}
