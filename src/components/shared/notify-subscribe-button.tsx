"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";

interface NotifySubscribeButtonProps {
  eventType: string;
  department?: string | null;
  eventSlug?: string;
  source: string;
  variant?: "icon" | "inline";
  className?: string;
  stopPropagation?: boolean;
}

export function NotifySubscribeButton({
  eventType,
  department,
  eventSlug,
  source,
  variant = "icon",
  className,
  stopPropagation = false,
}: NotifySubscribeButtonProps) {
  const router = useRouter();

  const targetHref = useMemo(() => {
    const params = new URLSearchParams({
      type: eventType,
      source: "notify-like",
      utm_source: source,
      utm_medium: "cta",
      utm_campaign: "newsletter",
    });

    if (department) params.set("department", department);
    if (eventSlug) params.set("event", eventSlug);

    return `/suscribirse?${params.toString()}`;
  }, [department, eventSlug, eventType, source]);

  const onClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (stopPropagation) {
      event.preventDefault();
      event.stopPropagation();
    }

    router.push(targetHref);
  };

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex min-h-10 items-center gap-2 rounded-full border border-indigo-400/35 bg-gradient-to-r from-indigo-500/22 to-teal-500/22 px-4 py-2 text-[12px] font-semibold text-white transition hover:brightness-110",
          className,
        )}
      >
        <Bell className="h-4 w-4" strokeWidth={2.2} />
        Notificarme eventos como este
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/18 bg-black/45 text-white backdrop-blur-md transition-all duration-200 hover:bg-black/65 hover:border-white/28",
        className,
      )}
      aria-label="Notificarme eventos como este"
      title="Notificarme eventos como este"
    >
      <Bell className="h-4.5 w-4.5 text-[#C7D2FE]" strokeWidth={2.2} />
    </button>
  );
}
