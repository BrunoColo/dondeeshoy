import {
  boolean,
  date,
  decimal,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  unique,
  uuid,
  varchar,
  index,
} from "drizzle-orm/pg-core";

export const sourceEnum = pgEnum("source", ["redtickets", "entraste"]);
export const eventTypeEnum = pgEnum("event_type", [
  "fiesta",
  "festival",
  "recital",
  "club",
  "bar",
  "teatro",
  "otro",
]);
export const eventStatusEnum = pgEnum("event_status", ["active", "cancelled", "past"]);

export const rawEvents = pgTable(
  "raw_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    source: sourceEnum("source").notNull(),
    sourceId: varchar("source_id", { length: 255 }).notNull(),
    sourceUrl: varchar("source_url", { length: 2048 }).notNull(),
    rawData: jsonb("raw_data").$type<Record<string, unknown>>().notNull(),
    scrapedAt: timestamp("scraped_at", { withTimezone: true }).defaultNow().notNull(),
    processed: boolean("processed").default(false).notNull(),
    processingError: text("processing_error"),
  },
  (table) => [unique("raw_events_source_source_id_unique").on(table.source, table.sourceId)],
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    description: text("description"),
    date: date("date").notNull(),
    startTime: time("start_time"),
    endTime: time("end_time"),
    venueName: varchar("venue_name", { length: 255 }).notNull(),
    venueAddress: varchar("venue_address", { length: 512 }),
    latitude: decimal("latitude", { precision: 10, scale: 7 }),
    longitude: decimal("longitude", { precision: 10, scale: 7 }),
    city: varchar("city", { length: 100 }).default("Montevideo").notNull(),
    eventType: eventTypeEnum("event_type").default("otro").notNull(),
    musicGenre: varchar("music_genre", { length: 100 }),
    imageUrl: varchar("image_url", { length: 2048 }),
    ticketUrl: varchar("ticket_url", { length: 2048 }),
    priceMin: integer("price_min"),
    priceMax: integer("price_max"),
    currency: varchar("currency", { length: 8 }).default("UYU").notNull(),
    isFree: boolean("is_free").default(false).notNull(),
    ageRestriction: integer("age_restriction"),
    confidenceScore: decimal("confidence_score", { precision: 3, scale: 2 }).default("0.00").notNull(),
    viewCount: integer("view_count").default(0).notNull(),
    status: eventStatusEnum("status").default("active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("events_date_city_status_idx").on(table.date, table.city, table.status),
    index("events_slug_idx").on(table.slug),
    index("events_event_type_idx").on(table.eventType),
  ],
);

export const eventSources = pgTable("event_sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  rawEventId: uuid("raw_event_id")
    .notNull()
    .references(() => rawEvents.id, { onDelete: "cascade" }),
  source: sourceEnum("source").notNull(),
  sourceUrl: varchar("source_url", { length: 2048 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type RawEvent = typeof rawEvents.$inferSelect;
export type NewRawEvent = typeof rawEvents.$inferInsert;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
