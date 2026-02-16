/**
 * Date/time/price formatting utilities for Uruguay (UTC-3)
 */

const UY_TIMEZONE = "America/Montevideo";

const DAYS_ES = [
  "Domingo", "Lunes", "Martes", "Miércoles",
  "Jueves", "Viernes", "Sábado",
] as const;

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
] as const;

/**
 * Get the current date in Uruguay timezone as YYYY-MM-DD
 */
export function getTodayUY(): string {
  const now = new Date();
  const uyDate = new Date(now.toLocaleString("en-US", { timeZone: UY_TIMEZONE }));
  const year = uyDate.getFullYear();
  const month = String(uyDate.getMonth() + 1).padStart(2, "0");
  const day = String(uyDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get tomorrow's date in Uruguay timezone as YYYY-MM-DD
 */
export function getTomorrowUY(): string {
  const now = new Date();
  const uyDate = new Date(now.toLocaleString("en-US", { timeZone: UY_TIMEZONE }));
  uyDate.setDate(uyDate.getDate() + 1);
  const year = uyDate.getFullYear();
  const month = String(uyDate.getMonth() + 1).padStart(2, "0");
  const day = String(uyDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get a date N days from today in UY timezone
 */
export function getDateOffsetUY(days: number): string {
  const now = new Date();
  const uyDate = new Date(now.toLocaleString("en-US", { timeZone: UY_TIMEZONE }));
  uyDate.setDate(uyDate.getDate() + days);
  const year = uyDate.getFullYear();
  const month = String(uyDate.getMonth() + 1).padStart(2, "0");
  const day = String(uyDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get the current time in UY as { hours, minutes }
 */
export function getNowUY(): { hours: number; minutes: number } {
  const now = new Date();
  const uyDate = new Date(now.toLocaleString("en-US", { timeZone: UY_TIMEZONE }));
  return { hours: uyDate.getHours(), minutes: uyDate.getMinutes() };
}

/**
 * Format a date string (YYYY-MM-DD) for display in Spanish
 * Returns: "Lunes 16 de febrero"
 */
export function formatDateES(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const dayName = DAYS_ES[date.getDay()];
  const monthName = MONTHS_ES[date.getMonth()];
  return `${dayName} ${day} de ${monthName}`;
}

/**
 * Get a relative label for a date
 * "HOY", "MAÑANA", or "Miércoles 18 de febrero"
 */
export function getDateLabel(dateStr: string): { label: string; isToday: boolean; isTomorrow: boolean } {
  const today = getTodayUY();
  const tomorrow = getTomorrowUY();

  if (dateStr === today) {
    return { label: "HOY", isToday: true, isTomorrow: false };
  }
  if (dateStr === tomorrow) {
    return { label: "MAÑANA", isToday: false, isTomorrow: true };
  }
  return { label: formatDateES(dateStr), isToday: false, isTomorrow: false };
}

/**
 * Format a time string (HH:MM:SS or HH:MM) for display
 * "23:00:00" → "23:00"
 */
export function formatTime(timeStr: string | null | undefined): string | null {
  if (!timeStr) return null;
  const parts = timeStr.split(":");
  return `${parts[0]}:${parts[1]}`;
}

/**
 * Determine time status relative to now
 */
export type TimeStatus =
  | { type: "now" }
  | { type: "soon"; label: string }
  | { type: "later"; label: string }
  | { type: "unknown" };

export function getTimeStatus(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  eventDate: string,
): TimeStatus {
  const today = getTodayUY();
  if (eventDate !== today) {
    const formatted = formatTime(startTime);
    if (formatted) return { type: "later", label: formatted };
    return { type: "unknown" };
  }

  if (!startTime) return { type: "unknown" };

  const { hours: nowH, minutes: nowM } = getNowUY();
  const nowMinutes = nowH * 60 + nowM;

  const [sh, sm] = startTime.split(":").map(Number);
  const startMinutes = sh * 60 + sm;

  let endMinutes = Infinity;
  if (endTime) {
    const [eh, em] = endTime.split(":").map(Number);
    endMinutes = eh * 60 + em;
    // Handle events that cross midnight
    if (endMinutes < startMinutes) endMinutes += 24 * 60;
  }

  // Adjust now for post-midnight events
  let adjustedNow = nowMinutes;
  if (startMinutes > 18 * 60 && nowMinutes < 6 * 60) {
    adjustedNow += 24 * 60;
  }

  if (adjustedNow >= startMinutes && adjustedNow <= endMinutes) {
    return { type: "now" };
  }

  const diff = startMinutes - adjustedNow;
  if (diff > 0 && diff <= 120) {
    if (diff < 60) {
      return { type: "soon", label: `En ${diff} min` };
    }
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    if (mins === 0) return { type: "soon", label: `En ${hours}h` };
    return { type: "soon", label: `En ${hours}h ${mins}m` };
  }

  const formatted = formatTime(startTime);
  if (formatted) return { type: "later", label: formatted };
  return { type: "unknown" };
}

/**
 * Format price for display
 */
export function formatPrice(
  priceMin: number | null | undefined,
  priceMax: number | null | undefined,
  isFree: boolean,
  currency: string = "UYU",
): string | null {
  if (isFree) return "GRATIS";

  const symbol = currency === "UYU" ? "$" : currency === "USD" ? "US$" : currency;

  if (priceMin != null && priceMax != null && priceMin !== priceMax) {
    return `Desde ${symbol}${priceMin}`;
  }
  if (priceMin != null) {
    return `${symbol}${priceMin}`;
  }
  if (priceMax != null) {
    return `${symbol}${priceMax}`;
  }
  return null;
}

/**
 * Get the short day name for a date
 */
export function getShortDayName(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return DAYS_ES[date.getDay()].slice(0, 3).toUpperCase();
}
