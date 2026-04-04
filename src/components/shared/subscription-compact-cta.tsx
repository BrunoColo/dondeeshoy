"use client";

import Link from "next/link";
import { Mail } from "lucide-react";
import { cn } from "@/lib/utils";

interface SubscriptionCompactCtaProps {
  title: string;
  description: string;
  href?: string;
  ctaText?: string;
  className?: string;
  variant?: "default" | "map";
}

export function SubscriptionCompactCta({
  title,
  description,
  href = "/suscribirse",
  ctaText = "Suscribirme gratis",
  className,
  variant = "default",
}: SubscriptionCompactCtaProps) {
  return (
    <div
      className={cn(
        variant === "map"
          ? "rounded-xl border border-white/[0.08] bg-white/[0.04] p-3 sm:p-3.5"
          : "rounded-xl border border-indigo-400/20 bg-[linear-gradient(135deg,rgba(79,70,229,0.16)_0%,rgba(99,102,241,0.12)_45%,rgba(13,148,136,0.18)_100%)] p-3 sm:p-4",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            variant === "map"
              ? "border border-white/[0.12] bg-white/[0.05]"
              : "border border-white/20 bg-black/20",
          )}
        >
          <Mail
            className={cn("h-4 w-4", variant === "map" ? "text-[#99F6E4]" : "text-[#C7D2FE]")}
            strokeWidth={2.1}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-[13px] font-bold leading-tight",
              variant === "map" ? "text-[#E2E8F0]" : "text-white",
            )}
          >
            {title}
          </p>
          <p
            className={cn(
              "mt-1 text-[12px] leading-relaxed",
              variant === "map" ? "text-[#94A3B8]" : "text-[#CBD5E1]",
            )}
          >
            {description}
          </p>
          <Link
            href={href}
            className={cn(
              "mt-2.5 inline-flex items-center rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all",
              variant === "map"
                ? "rounded-lg border border-[#0D9488]/35 bg-[#0D9488]/12 text-[#99F6E4] hover:bg-[#0D9488]/18 hover:border-[#0D9488]/50"
                : "border border-white/20 bg-white/[0.08] text-white hover:bg-white/[0.14]",
            )}
          >
            {ctaText}
          </Link>
        </div>
      </div>
    </div>
  );
}
