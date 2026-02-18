"use client";

import { useState } from "react";
import { Ticket, ExternalLink, Loader2 } from "lucide-react";

interface TicketButtonProps {
  ticketUrl: string;
}

/**
 * "Comprar entradas" CTA button with loading state to prevent double-clicks.
 * Shows a spinner for 1.5s after click while the external page opens.
 */
export function TicketButton({ ticketUrl }: TicketButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = () => {
    if (loading) return;
    setLoading(true);
    window.open(ticketUrl, "_blank", "noopener,noreferrer");
    // Reset after 1.5s — enough time for the external tab to open
    setTimeout(() => setLoading(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="btn-neon flex w-full items-center justify-center gap-2 text-center disabled:opacity-80 disabled:cursor-not-allowed"
      aria-label={loading ? "Abriendo sitio de entradas…" : "Comprar entradas"}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
          <span>Abriendo…</span>
        </>
      ) : (
        <>
          <Ticket className="h-4 w-4" strokeWidth={2} />
          <span>Comprar entradas</span>
          <ExternalLink className="h-3.5 w-3.5 opacity-60" strokeWidth={2} />
        </>
      )}
    </button>
  );
}
