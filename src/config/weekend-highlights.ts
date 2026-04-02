import type { EventType } from "@/types/events";

export const WEEKEND_HIGHLIGHT_LIMIT = 6;

/**
 * Type mix to keep the rail varied in automatic mode.
 * Remaining slots fall back to the editorial ranking score.
 */
export const WEEKEND_HIGHLIGHT_TYPE_TARGETS: Array<{ type: EventType; count: number }> = [
  { type: "fiesta", count: 2 },
  { type: "teatro", count: 2 },
  { type: "cultural", count: 1 },
  { type: "deportivo", count: 1 },
];