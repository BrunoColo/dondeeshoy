import type { EventType } from "@/types/events";

export const WEEKEND_HIGHLIGHT_LIMIT = 6;

/**
 * Editorial picks for the "Lo mejor del finde" rail.
 *
 * Add event slugs here in the exact order you want them to appear.
 * Only active, non-recurring events inside the current weekend window are used.
 * Missing/out-of-range slugs are ignored automatically.
 */
export const WEEKEND_HIGHLIGHT_MANUAL_SLUGS: string[] = [
   "tedx-punta-del-este-2026-2026-03-14",
   "mega-rancho-temporada-2026-2026-03-13",
   "mi-madre-mi-novia-y-yo-2026-03-14",
   "restos-de-verano-rico-los-robados-solistah-2026-03-14",
   "la-china-lgante-2026-03-13",
   "dino-aventura-punta-del-este-marzo-2026-03-13"   
];

/**
 * Type mix to keep the rail varied even without manual curation.
 * Remaining slots fall back to the normal ranking score.
 */
export const WEEKEND_HIGHLIGHT_TYPE_TARGETS: Array<{ type: EventType; count: number }> = [
  { type: "fiesta", count: 2 },
  { type: "teatro", count: 2 },
  { type: "cultural", count: 1 },
  { type: "deportivo", count: 1 },
];