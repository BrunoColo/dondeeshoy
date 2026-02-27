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
    <div className="flex items-center justify-between">
      {/* Time — grande y prominente */}
      <div className="flex items-baseline font-mono">
        <span className="text-[28px] font-black text-white tracking-tight leading-none">{hours}</span>
        <span
          className="text-[28px] font-black mx-0.5 transition-opacity duration-200 leading-none"
          style={{ opacity: showColon ? 1 : 0.2, color: "#818CF8" }}
        >
          :
        </span>
        <span className="text-[28px] font-black text-white tracking-tight leading-none">{minutes}</span>
      </div>
      {/* Date — a la derecha */}
      <div className="flex flex-col items-end leading-none gap-0.5">
        <span className="text-[12px] font-semibold text-[#B8C5D6]">{dayName}</span>
        <span className="text-[11px] text-[#7A8FA6] font-mono">{dayNum} de {monthName}</span>
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
      className="flex flex-col items-center gap-1.5 rounded-xl py-3.5 px-2"
      style={{
        background: "linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      <span className="text-[22px] font-black text-white font-mono leading-none tabular-nums">
        {displayed}
      </span>
      <span className="text-[9px] text-[#7A8FA6] text-center leading-tight uppercase tracking-wider font-bold">
        {label}
      </span>
    </div>
  );
}
