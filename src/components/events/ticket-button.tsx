"use client";

import { useState } from "react";

interface TicketButtonProps {
  eventId?: string;
  ticketUrl: string;
}

/**
 * "Comprar entradas" CTA button with loading state to prevent double-clicks.
 * Shows a spinner for 1.5s after click while the external page opens.
 */
export function TicketButton({ eventId, ticketUrl }: TicketButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = () => {
    if (loading) return;
    setLoading(true);

    if (eventId) {
      fetch("/api/events/ticket-click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      }).catch(() => {
        // Silently ignore analytics errors
      });
    }

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
        <span>Abriendo…</span>
      ) : (
        <span>Comprar entradas</span>
      )}
    </button>
  );
}
