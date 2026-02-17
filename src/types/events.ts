export type EventType =
  | "fiesta"
  | "festival"
  | "recital"
  | "club"
  | "bar"
  | "teatro"
  | "otro";

export type EventStatus = "active" | "cancelled" | "past";

export const EVENT_TYPES: EventType[] = [
  "fiesta",
  "festival",
  "recital",
  "club",
  "bar",
  "teatro",
  "otro",
];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  fiesta: "Fiesta",
  festival: "Festival",
  recital: "Recital",
  club: "Club",
  bar: "Bar",
  teatro: "Teatro",
  otro: "Evento",
};

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
  isTrending?: boolean;
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
  viewCount?: number;
}

/** Filter options passed via URL search params */
export interface EventFilters {
  q?: string;
  type?: EventType;
  genre?: string;
  department?: string;
  free?: boolean;
}
