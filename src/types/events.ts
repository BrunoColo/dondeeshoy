export type EventType =
  | "fiesta"
  | "festival"
  | "recital"
  | "club"
  | "bar"
  | "teatro"
  | "otro";

export interface EventCardData {
  id: string;
  slug: string;
  name: string;
  date: string;
  startTime?: string | null;
  venueName: string;
  city: string;
  eventType: EventType;
  priceMin?: number | null;
  priceMax?: number | null;
  isFree: boolean;
}
