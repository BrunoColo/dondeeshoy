"use client";

import { useState, useEffect } from "react";

const DAYS_ES = [
  "Domingo", "Lunes", "Martes", "Miércoles",
  "Jueves", "Viernes", "Sábado",
];

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/**
 * Live clock + date display for the sidebar.
 * Shows current time in Uruguay timezone with a pulsing separator.
 */
export function SidebarLiveClock() {
  const [now, setNow] = useState<Date | null>(null);
  const [showColon, setShowColon] = useState(true);

  useEffect(() => {
    // First tick fires via 0ms timeout to avoid sync setState in effect
    const init = setTimeout(() => setNow(new Date()), 0);
    const timer = setInterval(() => setNow(new Date()), 1000);
    const blink = setInterval(() => setShowColon((v) => !v), 500);
    return () => {
      clearTimeout(init);
      clearInterval(timer);
      clearInterval(blink);
    };
  }, []);

  if (!now) {
    return (
      <div className="flex items-center gap-3 animate-pulse">
        <div className="h-8 w-20 rounded bg-white/5" />
        <div className="h-4 w-32 rounded bg-white/5" />
      </div>
    );
  }

  const uyTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Montevideo" }));
  const hours = String(uyTime.getHours()).padStart(2, "0");
  const minutes = String(uyTime.getMinutes()).padStart(2, "0");
  const dayName = DAYS_ES[uyTime.getDay()];
  const dayNum = uyTime.getDate();
  const monthName = MONTHS_ES[uyTime.getMonth()];

  return (
    <div className="flex items-center gap-3">
      {/* Time */}
      <div className="flex items-baseline font-mono">
        <span className="text-2xl font-bold text-white tracking-tight">{hours}</span>
        <span
          className="text-2xl font-bold mx-[1px] transition-opacity duration-200"
          style={{ opacity: showColon ? 1 : 0.25, color: "#14B8A6" }}
        >
          :
        </span>
        <span className="text-2xl font-bold text-white tracking-tight">{minutes}</span>
      </div>
      {/* Date */}
      <div className="flex flex-col leading-none">
        <span className="text-[11px] font-semibold text-white/60">{dayName}</span>
        <span className="text-[10px] text-white/30">{dayNum} de {monthName}</span>
      </div>
    </div>
  );
}

/**
 * Animated stat counter — counts up from 0 to the target value.
 */
export function AnimatedStat({ value, label }: { value: number; label: string }) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    if (value === 0) {
      setDisplayed(0);
      return;
    }

    const duration = 1200; // ms
    const steps = 30;
    const stepTime = duration / steps;
    let current = 0;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      // Ease-out curve
      const progress = step / steps;
      const eased = 1 - Math.pow(1 - progress, 3);
      current = Math.round(eased * value);
      setDisplayed(current);

      if (step >= steps) {
        setDisplayed(value);
        clearInterval(timer);
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <div
      className="flex flex-col items-center gap-1 rounded-lg py-3 px-2"
      style={{
        backgroundColor: "#111A1C",
        border: "1px solid rgba(255,255,255,0.09)",
      }}
    >
      <span className="text-xl font-bold text-white font-mono leading-none tabular-nums">
        {displayed}
      </span>
      <span className="text-[9px] text-white/35 text-center leading-tight uppercase tracking-wide font-semibold">
        {label}
      </span>
    </div>
  );
}
