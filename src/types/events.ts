export type EventType =
  | "fiesta"
  | "festival"
  | "recital"
  | "club"
  | "bar"
  | "teatro"
  | "otro";

export type EventStatus = "active" | "cancelled" | "past";

export interface EventCardData {
  id: string;
  slug: string;
  name: string;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  venueName: string;
  city: string;
  eventType: EventType;
  imageUrl?: string | null;
  priceMin?: number | null;
  priceMax?: number | null;
  isFree: boolean;
  currency?: string;
  musicGenre?: string | null;
}

export interface EventDetailData extends EventCardData {
  description?: string | null;
  venueAddress?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  ticketUrl?: string | null;
  ageRestriction?: number | null;
  confidenceScore: string;
  status: EventStatus;
}
