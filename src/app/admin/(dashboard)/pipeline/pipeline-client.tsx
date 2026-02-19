"use client";

import { useState } from "react";

export function PipelineClient({ 
  action, 
  label 
}: { 
  action: "run" | "mark-past"; 
  label: string;
}) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const handleAction = async () => {
    setLoading(true);
    setStatus("idle");

    try {
      const res = await fetch(`/api/admin/pipeline/${action}`, {
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
      onClick={handleAction}
      disabled={loading}
      className={`px-4 py-2 text-sm rounded transition-colors ${
        loading
          ? "bg-zinc-700 text-zinc-400 cursor-wait"
          : status === "success"
          ? "bg-green-900/50 text-green-400 border border-green-800"
          : status === "error"
          ? "bg-red-900/50 text-red-400 border border-red-800"
          : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
      }`}
    >
      {loading ? "Running..." : status === "success" ? "Done" : status === "error" ? "Error" : label}
    </button>
  );
}
