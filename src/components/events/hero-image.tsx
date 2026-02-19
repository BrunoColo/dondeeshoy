"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Music } from "lucide-react";
import type { EventType } from "@/types/events";

const TYPE_GRADIENT: Record<string, string> = {
  fiesta: "from-violet-600/30 via-fuchsia-600/20 to-transparent",
  festival: "from-pink-600/30 via-rose-600/20 to-transparent",
  concierto: "from-sky-600/30 via-blue-600/20 to-transparent",
  recital: "from-cyan-500/30 via-sky-600/20 to-transparent",
  cultural: "from-indigo-600/30 via-violet-600/20 to-transparent",
  deportivo: "from-green-600/30 via-emerald-600/20 to-transparent",
  gastronomico: "from-orange-600/30 via-amber-600/20 to-transparent",
  familiar: "from-lime-500/30 via-green-500/20 to-transparent",
  feria: "from-rose-600/30 via-pink-600/20 to-transparent",
  taller: "from-teal-600/30 via-cyan-600/20 to-transparent",
  club: "from-blue-600/30 via-indigo-600/20 to-transparent",
  bar: "from-amber-500/30 via-yellow-600/20 to-transparent",
  teatro: "from-emerald-500/30 via-teal-600/20 to-transparent",
  otro: "from-slate-500/20 via-slate-600/10 to-transparent",
};

interface HeroImageProps {
  imageUrl: string | null;
  alt: string;
  eventType: EventType;
}

export function HeroImage({ imageUrl, alt, eventType }: HeroImageProps) {
  const [imgError, setImgError] = useState(false);
  const showImage = imageUrl && !imgError;
  const gradientClass = TYPE_GRADIENT[eventType] ?? TYPE_GRADIENT.otro;

  if (showImage) {
    return (
      <div className="img-overlay relative w-full h-48 sm:h-64 md:h-80 lg:h-96 overflow-hidden">
        <Image
          src={imageUrl}
          alt={alt}
          fill
          className="object-cover"
          sizes="100vw"
          priority
          unoptimized
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  // No image or broken image — gradient fallback
  return (
    <div className="relative w-full h-40 sm:h-52 md:h-64 overflow-hidden">
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-60",
          gradientClass,
        )}
      />
      {/* Subtle decorative icon */}
      <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-[0.05]">
        <Music className="h-28 w-28 sm:h-36 sm:w-36 text-white" strokeWidth={1} />
      </div>
    </div>
  );
}
