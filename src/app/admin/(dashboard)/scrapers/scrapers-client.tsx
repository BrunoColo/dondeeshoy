"use client";

import { useState } from "react";

export function ScrapersClient({ source }: { source: string }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const handleScrape = async () => {
    setLoading(true);
    setStatus("idle");

    try {
      const res = await fetch(`/api/admin/scrapers/${source}/run`, {
        method: "POST",
      });

      const data = await res.json();
      
      if (res.ok && data.success) {
        setStatus("success");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleScrape}
      disabled={loading}
      className={`px-3 py-1 text-xs rounded transition-colors ${
        loading
          ? "bg-zinc-700 text-zinc-400 cursor-wait"
          : status === "success"
          ? "bg-green-900/50 text-green-400 border border-green-800"
          : status === "error"
          ? "bg-red-900/50 text-red-400 border border-red-800"
          : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
      }`}
    >
      {loading ? "Run..." : status === "success" ? "OK" : status === "error" ? "Error" : "Run"}
    </button>
  );
}
