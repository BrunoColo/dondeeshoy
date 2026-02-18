import {
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { eventTypeEnum } from "./events";

export const submissionStatusEnum = pgEnum("submission_status", [
  "pending",
  "approved",
  "rejected",
]);

export const eventSubmissions = pgTable("event_submissions", {
  id: uuid("id").defaultRandom().primaryKey(),

  // Contact
  contactName: varchar("contact_name", { length: 255 }).notNull(),
  contactEmail: varchar("contact_email", { length: 255 }).notNull(),

  // Event info
  eventName: varchar("event_name", { length: 255 }).notNull(),
  eventDate: varchar("event_date", { length: 20 }).notNull(), // stored as ISO date string
  eventTime: varchar("event_time", { length: 10 }), // optional HH:MM
  eventType: eventTypeEnum("event_type").default("otro").notNull(),
  description: text("description").notNull(),

  // Venue
  venueName: varchar("venue_name", { length: 255 }).notNull(),
  venueAddress: varchar("venue_address", { length: 512 }).notNull(),
  city: varchar("city", { length: 100 }).notNull(),

  // Tickets
  isFree: boolean("is_free").default(true).notNull(),
  priceRange: varchar("price_range", { length: 100 }),
  ticketUrl: varchar("ticket_url", { length: 2048 }),

  // Media
  imageUrl: varchar("image_url", { length: 2048 }),

  // Review
  status: submissionStatusEnum("status").default("pending").notNull(),
  notes: text("notes"),

  // Timestamps
  submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
});

export type EventSubmission = typeof eventSubmissions.$inferSelect;
export type NewEventSubmission = typeof eventSubmissions.$inferInsert;
